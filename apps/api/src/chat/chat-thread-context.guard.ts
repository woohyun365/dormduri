import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  DOMAIN_CONTEXT_REQUIREMENTS_METADATA_KEY,
  type ChatThreadMemberContextRequirement,
  type DomainContextRequirement,
} from '../common/domain-context/domain-context.decorator.js';
import { badRequestError, unauthorizedError } from '../common/http/api-error.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { chatErrors } from './errors/chat.errors.js';
import {
  setChatThreadContext,
  type ChatThreadContextRequest,
} from './chat-thread-context.types.js';

@Injectable()
export class ChatThreadContextGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.resolveChatThreadRequirement(context);
    if (!requirement) {
      return true;
    }

    const request = context.switchToHttp().getRequest<ChatThreadContextRequest>();
    if (!request.authUser) {
      throw unauthorizedError('UNAUTHENTICATED', '로그인이 필요합니다.');
    }

    const threadId = resolveRequiredParam(request, requirement.param);
    const thread = await this.prisma.conversationThread.findFirst({
      where: {
        id: threadId,
        status: { in: ['OPEN', 'READ_ONLY'] },
        members: {
          some: {
            memberState: 'ACTIVE',
            participant: {
              userId: request.authUser.id,
              hiddenByAdminAt: null,
              deactivatedAt: null,
              user: {
                deletedAt: null,
              },
            },
          },
        },
      },
      select: {
        id: true,
        status: true,
        closedAt: true,
        closedReason: true,
        members: {
          where: {
            participant: {
              userId: request.authUser.id,
            },
          },
          select: {
            participantId: true,
            memberState: true,
            lastVisibleAt: true,
            participant: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    });

    const actorMember = thread?.members.find(
      (member) =>
        member.participant.userId === request.authUser?.id && member.memberState === 'ACTIVE',
    );
    if (!thread || !actorMember) {
      throw chatErrors.threadNotFound();
    }

    setChatThreadContext(request, {
      threadId: thread.id,
      actorUserId: request.authUser.id,
      actorParticipantId: actorMember.participantId,
      memberState: actorMember.memberState,
      threadStatus: thread.status,
      closedAt: thread.closedAt,
      closedReason: thread.closedReason,
      lastVisibleAt: actorMember.lastVisibleAt,
    });

    return true;
  }

  private resolveChatThreadRequirement(
    context: ExecutionContext,
  ): ChatThreadMemberContextRequirement | null {
    const requirements = [
      ...(this.reflector.get<readonly DomainContextRequirement[]>(
        DOMAIN_CONTEXT_REQUIREMENTS_METADATA_KEY,
        context.getClass(),
      ) ?? []),
      ...(this.reflector.get<readonly DomainContextRequirement[]>(
        DOMAIN_CONTEXT_REQUIREMENTS_METADATA_KEY,
        context.getHandler(),
      ) ?? []),
    ];

    return (
      requirements.find(
        (requirement): requirement is ChatThreadMemberContextRequirement =>
          requirement.kind === 'chat-thread-member',
      ) ?? null
    );
  }
}

function resolveRequiredParam(request: ChatThreadContextRequest, param: 'threadId') {
  const value = request.params?.[param];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw badRequestError('CHAT_THREAD_ID_REQUIRED', '채팅 thread id가 필요합니다.');
  }

  return value.trim();
}

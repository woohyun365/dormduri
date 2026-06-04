import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  DOMAIN_CONTEXT_REQUIREMENTS_METADATA_KEY,
  type ChatThreadMemberContextRequirement,
  type DomainContextRequirement,
} from '../../common/domain-context/domain-context.decorator.js';
import { badRequestError, unauthorizedError } from '../../platform/http/api-error.js';
import { chatErrors } from '../errors/chat.errors.js';
import { ChatThreadContextResolver } from './chat-thread-context.resolver.js';
import {
  setChatThreadContext,
  type ChatThreadContextRequest,
} from './chat-thread-context.types.js';

@Injectable()
export class ChatThreadContextGuard implements CanActivate {
  constructor(
    private readonly resolver: ChatThreadContextResolver,
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
    const chatThread = await this.resolver.resolveVisibleActiveMemberContext({
      actorUserId: request.authUser.id,
      threadId,
    });

    if (!chatThread) {
      throw chatErrors.threadNotFound();
    }

    setChatThreadContext(request, chatThread);

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

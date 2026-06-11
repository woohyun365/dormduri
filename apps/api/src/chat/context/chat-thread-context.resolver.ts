import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import type { ChatThreadContext } from './chat-thread-context.types.js';

const chatThreadMemberContextSelect = {
  participantId: true,
  memberState: true,
  lastVisibleAt: true,
  participant: {
    select: {
      userId: true,
    },
  },
} satisfies Prisma.ConversationThreadMemberSelect;

function chatThreadContextSelectForActor(actorUserId: string) {
  return {
    id: true,
    status: true,
    closedAt: true,
    closedReason: true,
    members: {
      where: {
        participant: {
          userId: actorUserId,
        },
      },
      select: chatThreadMemberContextSelect,
    },
  } satisfies Prisma.ConversationThreadSelect;
}

type ChatThreadContextRecord = Prisma.ConversationThreadGetPayload<{
  select: ReturnType<typeof chatThreadContextSelectForActor>;
}>;

@Injectable()
export class ChatThreadContextResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolveVisibleActiveMemberContext(input: {
    actorUserId: string;
    threadId: string;
  }): Promise<ChatThreadContext | null> {
    const thread = await this.prisma.conversationThread.findFirst({
      where: {
        id: input.threadId,
        status: { in: ['OPEN', 'READ_ONLY'] },
        members: {
          some: {
            memberState: 'ACTIVE',
            participant: {
              userId: input.actorUserId,
              hiddenByAdminAt: null,
              deactivatedAt: null,
              user: {
                deletedAt: null,
              },
            },
          },
        },
      },
      select: chatThreadContextSelectForActor(input.actorUserId),
    });

    return toChatThreadContext(thread, input.actorUserId);
  }
}

function toChatThreadContext(
  thread: ChatThreadContextRecord | null,
  actorUserId: string,
): ChatThreadContext | null {
  const actorMember = thread?.members.find(
    (member) => member.participant.userId === actorUserId && member.memberState === 'ACTIVE',
  );
  if (!thread || !actorMember) {
    return null;
  }

  return {
    threadId: thread.id,
    actorUserId,
    actorParticipantId: actorMember.participantId,
    memberState: actorMember.memberState,
    threadStatus: thread.status,
    closedAt: thread.closedAt,
    closedReason: thread.closedReason,
    lastVisibleAt: actorMember.lastVisibleAt,
  };
}

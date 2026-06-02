import type { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import { buildParticipantPairIdentity } from '../matches/match.utils.js';
import type { ChatThreadListCursorBoundary } from './chat-thread-list-cursor.owner.js';
import {
  threadListSelect,
  threadSelect,
  toThreadRecordWithEmptyMessages,
  type ThreadRecord,
} from './chat-selects.js';

type ChatDbClient = Prisma.TransactionClient | PrismaService;

export function createChatQueryOwner(prisma: PrismaService) {
  return {
    async findThreadByPair(
      seasonId: string,
      leftParticipantId: string,
      rightParticipantId: string,
      client: ChatDbClient = prisma,
    ): Promise<ThreadRecord | null> {
      const pairIdentity = buildParticipantPairIdentity(leftParticipantId, rightParticipantId);

      return await client.conversationThread.findFirst({
        where: {
          seasonId,
          pairKey: pairIdentity.pairKey,
          status: { in: ['OPEN', 'READ_ONLY'] },
        },
        select: threadSelect,
      });
    },

    async findThreadsForViewer(
      userId: string,
      input: { limit: number; after: ChatThreadListCursorBoundary | null },
    ): Promise<{ hasNextPage: boolean; items: ThreadRecord[] }> {
      const threads = await prisma.conversationThread.findMany({
        where: {
          ...buildThreadListCursorWhere(input.after),
          status: { in: ['OPEN', 'READ_ONLY'] },
          members: {
            some: {
              participant: { userId },
              memberState: 'ACTIVE',
            },
          },
        },
        orderBy: [
          { lastMessageAt: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        take: input.limit + 1,
        select: threadListSelect,
      });

      return {
        hasNextPage: threads.length > input.limit,
        items: threads.slice(0, input.limit).map(toThreadRecordWithEmptyMessages),
      };
    },

    async findThreadDetailForViewer(
      userId: string,
      threadId: string,
    ): Promise<ThreadRecord | null> {
      return await prisma.conversationThread.findFirst({
        where: {
          id: threadId,
          status: { in: ['OPEN', 'READ_ONLY'] },
          members: {
            some: {
              participant: { userId },
              memberState: 'ACTIVE',
            },
          },
        },
        select: threadSelect,
      });
    },

    async canSubscribeThreadForViewer(userId: string, threadId: string): Promise<boolean> {
      const count = await prisma.conversationThread.count({
        where: {
          id: threadId,
          status: { in: ['OPEN', 'READ_ONLY'] },
          members: {
            some: {
              memberState: 'ACTIVE',
              participant: {
                userId,
                hiddenByAdminAt: null,
                deactivatedAt: null,
                user: {
                  deletedAt: null,
                },
              },
            },
          },
        },
      });

      return count > 0;
    },

    async findLeavableThread(userId: string, threadId: string): Promise<ThreadRecord | null> {
      return await prisma.conversationThread.findFirst({
        where: {
          id: threadId,
          status: { in: ['OPEN', 'READ_ONLY'] },
          members: {
            some: {
              participant: { userId },
              memberState: 'ACTIVE',
            },
          },
        },
        select: threadSelect,
      });
    },
  };
}

function buildThreadListCursorWhere(
  after: ChatThreadListCursorBoundary | null,
): Prisma.ConversationThreadWhereInput {
  if (!after) {
    return {};
  }

  if (!after.lastMessageAt) {
    return {
      OR: [
        {
          lastMessageAt: null,
          createdAt: { lt: after.createdAt },
        },
        {
          lastMessageAt: null,
          createdAt: after.createdAt,
          id: { lt: after.threadId },
        },
      ],
    };
  }

  return {
    OR: [
      { lastMessageAt: { lt: after.lastMessageAt } },
      { lastMessageAt: null },
      {
        lastMessageAt: after.lastMessageAt,
        createdAt: { lt: after.createdAt },
      },
      {
        lastMessageAt: after.lastMessageAt,
        createdAt: after.createdAt,
        id: { lt: after.threadId },
      },
    ],
  };
}

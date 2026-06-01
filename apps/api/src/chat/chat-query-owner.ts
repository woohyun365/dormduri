import type { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import { buildParticipantPairIdentity } from '../matches/match.utils.js';
import { threadSelect, type ThreadRecord } from './chat-selects.js';

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

    async findThreadsForViewer(userId: string): Promise<ThreadRecord[]> {
      return await prisma.conversationThread.findMany({
        where: {
          status: { in: ['OPEN', 'READ_ONLY'] },
          members: {
            some: {
              participant: { userId },
              memberState: 'ACTIVE',
            },
          },
        },
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        select: threadSelect,
      });
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

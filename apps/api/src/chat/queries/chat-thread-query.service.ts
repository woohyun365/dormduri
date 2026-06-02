import type { ConversationStatsResponse } from '@repo/shared/chat-contract';
import type { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../common/prisma/prisma.service.js';
import { buildParticipantPairIdentity } from '../../matches/match.utils.js';
import type { ChatThreadListCursorBoundary } from './chat-thread-list-cursor.js';
import {
  threadListSelect,
  threadSelect,
  toThreadRecordWithEmptyMessages,
  type ThreadRecord,
} from '../persistence/chat-thread.select.js';

type ChatDbClient = Prisma.TransactionClient | PrismaService;

export function createChatThreadQueryService(prisma: PrismaService) {
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

    async getConversationStatsForUser(input: {
      userId: string;
      currentSeason: { id: string; name: string } | null;
    }): Promise<ConversationStatsResponse> {
      const participantRows = await prisma.seasonParticipant.findMany({
        where: { userId: input.userId },
        select: { id: true },
      });
      const participantIds = participantRows.map((participant) => participant.id);
      if (participantIds.length === 0) {
        return {
          current: input.currentSeason
            ? {
                seasonId: input.currentSeason.id,
                seasonName: input.currentSeason.name,
                conversationUserCount: 0,
              }
            : null,
          past: [],
        };
      }

      const participantIdSet = new Set(participantIds);
      const threads = await prisma.conversationThread.findMany({
        where: {
          OR: [
            { participantAId: { in: participantIds } },
            { participantBId: { in: participantIds } },
          ],
        },
        select: {
          seasonId: true,
          participantAId: true,
          participantBId: true,
          participantA: {
            select: {
              userId: true,
            },
          },
          participantB: {
            select: {
              userId: true,
            },
          },
          season: {
            select: {
              id: true,
              name: true,
              academicYear: true,
              semester: true,
            },
          },
        },
      });

      const statsBySeason = new Map<
        string,
        {
          seasonId: string;
          seasonName: string;
          academicYear: number;
          semester: number;
          counterpartUserIds: Set<string>;
        }
      >();

      for (const thread of threads) {
        const counterpartUserId = participantIdSet.has(thread.participantAId)
          ? thread.participantB.userId
          : participantIdSet.has(thread.participantBId)
            ? thread.participantA.userId
            : null;
        if (!counterpartUserId) {
          continue;
        }

        const existing = statsBySeason.get(thread.seasonId) ?? {
          seasonId: thread.season.id,
          seasonName: thread.season.name,
          academicYear: thread.season.academicYear,
          semester: thread.season.semester,
          counterpartUserIds: new Set<string>(),
        };
        existing.counterpartUserIds.add(counterpartUserId);
        statsBySeason.set(thread.seasonId, existing);
      }

      const toStatsSeason = (season: {
        seasonId: string;
        seasonName: string;
        counterpartUserIds: Set<string>;
      }) => ({
        seasonId: season.seasonId,
        seasonName: season.seasonName,
        conversationUserCount: season.counterpartUserIds.size,
      });

      const current = input.currentSeason
        ? (statsBySeason.get(input.currentSeason.id) ?? {
            seasonId: input.currentSeason.id,
            seasonName: input.currentSeason.name,
            academicYear: 0,
            semester: 0,
            counterpartUserIds: new Set<string>(),
          })
        : null;
      const past = Array.from(statsBySeason.values())
        .filter((season) => season.seasonId !== input.currentSeason?.id)
        .sort((left, right) => {
          const academicYearDiff = right.academicYear - left.academicYear;
          if (academicYearDiff !== 0) {
            return academicYearDiff;
          }
          const semesterDiff = right.semester - left.semester;
          if (semesterDiff !== 0) {
            return semesterDiff;
          }
          return left.seasonId.localeCompare(right.seasonId);
        })
        .map(toStatsSeason);

      return {
        current: current ? toStatsSeason(current) : null,
        past,
      };
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

import type { MatchHistoryResponse } from '@repo/shared/match-contract';
import { formatKstDate } from '../seasons/season.utils.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import {
  toMatchHistoryResponse,
  type MatchHistoryEntryRow,
  type MatchHistorySeasonRow,
} from './match-history-read-model.js';

export function createMatchHistoryReadOwner(prisma: PrismaService) {
  return {
    async listPastSeasonHistoryForUser(userId: string, now: Date): Promise<MatchHistoryResponse> {
      const todayDate = new Date(`${formatKstDate(now)}T00:00:00.000Z`);

      const seasons = await prisma.seasonParticipant.findMany({
        where: {
          userId,
          participationIntent: 'REGISTERED',
          registeredAt: { not: null },
          season: {
            seasonEndDate: {
              lt: todayDate,
            },
          },
        },
        orderBy: [
          { season: { academicYear: 'desc' } },
          { season: { semester: 'desc' } },
          { registeredAt: 'desc' },
          { createdAt: 'desc' },
        ],
        select: {
          id: true,
          seasonId: true,
          dormitoryId: true,
          season: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (seasons.length === 0) {
        return { items: [] };
      }

      const participantIds = seasons.map((season) => season.id);
      const historyRows = await prisma.seasonMatchHistoryEntry.findMany({
        where: {
          viewerParticipantId: { in: participantIds },
        },
        orderBy: [{ finalizedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          viewerParticipantId: true,
          counterpartParticipantId: true,
          counterpartNicknameSnapshot: true,
          entryType: true,
          entryResult: true,
          viewerRequested: true,
          hadConversation: true,
          matchedAt: true,
          unmatchedAt: true,
          finalizedAt: true,
          requestTerminalReason: true,
          activeMatchEndReason: true,
          threadClosedReason: true,
          threadClosedAt: true,
        },
      });

      return toMatchHistoryResponse({
        seasons: seasons.map(
          (season) =>
            ({
              participantId: season.id,
              seasonId: season.seasonId,
              seasonName: season.season.name,
              viewerDormitoryIdSnapshot: season.dormitoryId,
            }) satisfies MatchHistorySeasonRow,
        ),
        entries: historyRows satisfies MatchHistoryEntryRow[],
      });
    },
  };
}

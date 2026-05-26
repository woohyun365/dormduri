import type { MatchHistoryResponse } from '@repo/shared/match-contract';
import type { PublicProfile } from '@repo/shared/profile-contract';
import { formatKstDate, subtractDays } from '../seasons/season.utils.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import { lifestyleColumnSelect } from '../common/lifestyle/lifestyle.persistence.js';
import { mapProfileViewRecordFromColumns, toPublicProfile } from '../profiles/profile.mapper.js';
import {
  toMatchHistoryResponse,
  type MatchHistoryEntryRow,
  type MatchHistorySeasonRow,
} from './match-history-read-model.js';
import { matchesErrors } from './matches.errors.js';

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

      const counterpartParticipantIds = Array.from(
        new Set(historyRows.map((row) => row.counterpartParticipantId)),
      );
      const counterpartParticipants =
        counterpartParticipantIds.length > 0
          ? await prisma.seasonParticipant.findMany({
              where: { id: { in: counterpartParticipantIds } },
              select: {
                id: true,
                userId: true,
                user: {
                  select: {
                    deletedAt: true,
                  },
                },
              },
            })
          : [];
      const deletedCounterpartLabelByParticipantId = new Map(
        counterpartParticipants
          .filter((participant) => participant.user.deletedAt !== null)
          .map((participant) => [participant.id, '탈퇴한 사용자']),
      );

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
        entries: historyRows.map((row) => ({
          ...row,
          counterpartNicknameSnapshot:
            deletedCounterpartLabelByParticipantId.get(row.counterpartParticipantId) ??
            row.counterpartNicknameSnapshot,
        })) satisfies MatchHistoryEntryRow[],
      });
    },

    async getFinalCounterpartProfileForEntry(
      userId: string,
      entryId: string,
      now: Date,
    ): Promise<PublicProfile> {
      const entry = await prisma.seasonMatchHistoryEntry.findUnique({
        where: { id: entryId },
        select: {
          id: true,
          seasonId: true,
          counterpartParticipantId: true,
          entryType: true,
          entryResult: true,
          season: {
            select: {
              seasonEndDate: true,
            },
          },
          viewerParticipant: {
            select: {
              userId: true,
            },
          },
          counterpartParticipant: {
            select: {
              user: {
                select: {
                  id: true,
                  gender: true,
                  campus: true,
                  deletedAt: true,
                },
              },
            },
          },
        },
      });

      if (!entry) {
        throw matchesErrors.matchHistoryEntryNotFound();
      }

      if (entry.viewerParticipant.userId !== userId) {
        throw matchesErrors.matchHistoryEntryAccessDenied();
      }

      if (
        entry.entryType !== 'MATCH' ||
        (entry.entryResult !== 'MATCHED_SUCCESS' && entry.entryResult !== 'UNMATCHED_AFTER_SUCCESS')
      ) {
        throw matchesErrors.matchHistoryProfileNotAvailable();
      }

      if (entry.counterpartParticipant.user.deletedAt !== null) {
        throw matchesErrors.matchHistoryProfileNotAvailable();
      }

      const seasonEndBoundary = toSeasonEndBoundary(entry.season.seasonEndDate, now);
      const finalProfile =
        (await prisma.seasonParticipantProfileHistory.findFirst({
          where: {
            seasonId: entry.seasonId,
            participantId: entry.counterpartParticipantId,
            redactedAt: null,
            createdAt: { lte: seasonEndBoundary },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: seasonParticipantProfileHistoryPublicSelect,
        })) ??
        (await prisma.seasonParticipantProfileHistory.findFirst({
          where: {
            seasonId: entry.seasonId,
            participantId: entry.counterpartParticipantId,
            redactedAt: null,
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: seasonParticipantProfileHistoryPublicSelect,
        }));

      if (!finalProfile) {
        throw matchesErrors.matchHistoryProfileNotAvailable();
      }

      const profile = mapProfileViewRecordFromColumns({
        ...finalProfile,
        nickname: finalProfile.nicknameSnapshot,
        nicknameNormalized: finalProfile.nicknameNormalizedSnapshot,
      });

      return toPublicProfile(entry.counterpartParticipant.user, profile, {
        relationToViewer: 'MATCHED_PARTNER',
        actions: {
          canBookmark: false,
          canRequestMatch: false,
          canStartChat: false,
        },
        scoreVisible: false,
      });
    },
  };
}

const seasonParticipantProfileHistoryPublicSelect = {
  nicknameSnapshot: true,
  nicknameNormalizedSnapshot: true,
  ...lifestyleColumnSelect,
  intro: true,
  collegeCode: true,
  grade: true,
  mbti: true,
  birthYear: true,
} as const;

function toSeasonEndBoundary(seasonEndDate: Date, now: Date) {
  const seasonEnd = formatKstDate(seasonEndDate);
  const boundary = new Date(`${subtractDays(seasonEnd, -1)}T00:00:00+09:00`);
  return boundary.getTime() <= now.getTime() ? boundary : now;
}

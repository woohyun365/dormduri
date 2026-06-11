import { Injectable } from '@nestjs/common';
import type { MatchHistoryResponse } from '@repo/shared/match/contract';
import type { PublicProfile, PublicProfileActionCapabilities } from '@repo/shared/profile-contract';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { formatKstDate } from '../../../platform/time/kst-date.js';
import { DEIDENTIFIED_USER_DISPLAY_NAME } from '../../../privacy/deidentification/deidentified-display.policy.js';
import {
  mapProfileViewRecordFromColumns,
  toPublicProfile,
  toTombstonePublicProfile,
} from '../../../profiles/contracts/public-profile.presenter.js';
import { lifestyleColumnSelect } from '../../../season-participants/lifestyle/lifestyle-persistence.mapper.js';
import { matchesErrors } from '../../errors/matches.errors.js';
import { toSeasonEndBoundary } from '../materialization/match-history-materialization.policy.js';
import {
  toMatchHistoryResponse,
  type MatchHistoryEntryRow,
  type MatchHistorySeasonRow,
} from '../presenters/match-history.presenter.js';

@Injectable()
export class MatchHistoryQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async listPastSeasonHistoryForUser(userId: string, now: Date): Promise<MatchHistoryResponse> {
    const todayDate = new Date(`${formatKstDate(now)}T00:00:00.000Z`);

    const seasons = await this.prisma.seasonParticipant.findMany({
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
    const historyRows = await this.prisma.seasonMatchHistoryEntry.findMany({
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
        matchedAt: true,
        unmatchedAt: true,
        finalizedAt: true,
        requestTerminalReason: true,
        activeMatchEndReason: true,
      },
    });

    const counterpartParticipantIds = Array.from(
      new Set(historyRows.map((row) => row.counterpartParticipantId)),
    );
    const counterpartParticipants =
      counterpartParticipantIds.length > 0
        ? await this.prisma.seasonParticipant.findMany({
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
        .map((participant) => [participant.id, DEIDENTIFIED_USER_DISPLAY_NAME]),
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
  }

  async getFinalCounterpartProfileForEntry(
    userId: string,
    entryId: string,
    now: Date,
  ): Promise<PublicProfile> {
    const entry = await this.prisma.seasonMatchHistoryEntry.findUnique({
      where: { id: entryId },
      select: {
        id: true,
        seasonId: true,
        counterpartParticipantId: true,
        matchScore: true,
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

    if (entry.entryType !== 'MATCH' || entry.entryResult !== 'MATCHED_SUCCESS') {
      throw matchesErrors.matchHistoryProfileNotAvailable();
    }

    const seasonEndBoundary = toSeasonEndBoundary(entry.season.seasonEndDate, now);
    const finalProfile =
      (await this.prisma.seasonParticipantProfileHistory.findFirst({
        where: {
          seasonId: entry.seasonId,
          participantId: entry.counterpartParticipantId,
          redactedAt: null,
          createdAt: { lte: seasonEndBoundary },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: seasonParticipantProfileHistoryPublicSelect,
      })) ??
      (await this.prisma.seasonParticipantProfileHistory.findFirst({
        where: {
          seasonId: entry.seasonId,
          participantId: entry.counterpartParticipantId,
          redactedAt: null,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: seasonParticipantProfileHistoryPublicSelect,
      }));

    const resultRead = { resultReadable: true, context: 'PAST_MATCH_HISTORY' } as const;
    const actions = {
      canBookmark: false,
      canRequestMatch: false,
      canStartChat: false,
      unavailableReasons: ['SEASON_NOT_ACTIONABLE'],
    } satisfies PublicProfileActionCapabilities;

    if (entry.counterpartParticipant.user.deletedAt !== null || !finalProfile) {
      return toTombstonePublicProfile(entry.counterpartParticipant.user.id, {
        reason: 'TARGET_NO_LONGER_DISCOVERABLE',
        displayName:
          entry.counterpartParticipant.user.deletedAt !== null
            ? DEIDENTIFIED_USER_DISPLAY_NAME
            : undefined,
        relation: { type: 'MATCHED_PARTNER' },
        actions,
        resultRead,
      });
    }

    const profile = mapProfileViewRecordFromColumns({
      ...finalProfile,
      nickname: finalProfile.nicknameSnapshot,
      nicknameNormalized: finalProfile.nicknameNormalizedSnapshot,
    });

    return toPublicProfile(entry.counterpartParticipant.user, profile, {
      relation: { type: 'MATCHED_PARTNER' },
      actions: {
        canBookmark: false,
        canRequestMatch: false,
        canStartChat: false,
        unavailableReasons: ['SEASON_NOT_ACTIONABLE'],
      },
      resultRead,
      scoreVisible: typeof entry.matchScore === 'number',
      ...(typeof entry.matchScore === 'number' ? { matchScore: entry.matchScore } : {}),
    });
  }
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

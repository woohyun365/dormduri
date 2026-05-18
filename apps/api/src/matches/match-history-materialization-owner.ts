import { formatKstDate, subtractDays } from '../seasons/season.utils.js';
import { buildParticipantPairIdentity } from './match.utils.js';
import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import {
  ROOMMATE_CONDITION_FIELDS,
  CORE_LIFESTYLE_FIELDS,
  type LifestyleData,
} from '@repo/shared/lifestyle';
import { buildDirectionalMatchScoreProjection } from './match-score-projection.js';
import {
  lifestyleColumnSelect,
  toStoredBedtime,
  toStoredWakeTime,
  type LifestyleColumns,
  toLifestyleFromColumns,
} from '../profiles/profile-lifestyle.persistence.js';

export interface MatchHistoryMaterializationResult {
  processedSeasons: number;
  rebuiltEntries: number;
}

interface SeasonHistoryProfileSnapshot extends LifestyleColumns {
  participantId: string;
  nicknameSnapshot: string;
}

interface SeasonHistoryUserProfileSnapshot extends LifestyleColumns {
  nickname: string;
}

interface SeasonHistorySource {
  id: string;
  name: string;
  seasonEndDate: Date;
  participants: Array<{
    id: string;
    userId: string;
    participationIntent: 'UNDECIDED' | 'REGISTERED' | 'DECLINED';
    registeredAt: Date | null;
    declinedAt: Date | null;
    participantStatus: 'NOT_STARTED' | 'DRAFT' | 'ACTIVE' | 'MATCHED' | 'WITHDRAWN' | 'EXPIRED';
    dormitoryId: string | null;
    dormitorySelectionState: 'NOT_SELECTED' | 'UNASSIGNED' | 'ASSIGNED';
    hiddenByAdminAt: Date | null;
    deactivatedAt: Date | null;
    profile: SeasonHistoryProfileSnapshot | null;
    user: {
      profile: SeasonHistoryUserProfileSnapshot | null;
    };
  }>;
  matchRequests: Array<{
    id: string;
    requesterParticipantId: string;
    receiverParticipantId: string;
    status:
      | 'PENDING'
      | 'ACCEPTED'
      | 'REJECTED'
      | 'CANCELLED_BY_REQUESTER'
      | 'CANCELLED_BY_SYSTEM'
      | 'EXPIRED';
    terminalReason:
      | 'ACCEPTED'
      | 'REJECTED_BY_RECEIVER'
      | 'CANCELLED_BY_REQUESTER'
      | 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH'
      | 'EXPIRED'
      | 'WITHDRAWN_PARTICIPANT'
      | 'ADMIN_ACTION'
      | null;
    terminalAt: Date | null;
    createdAt: Date;
  }>;
  activeMatches: Array<{
    id: string;
    pairKey: string;
    participantAId: string;
    participantBId: string;
    status: 'ACTIVE' | 'UNMATCHED' | 'SEASON_ENDED' | 'ADMIN_ENDED';
    startedAt: Date;
    endedAt: Date | null;
    endReason:
      | 'UNMATCHED_BY_MUTUAL_CONSENT'
      | 'SEASON_ENDED'
      | 'ADMIN_ACTION'
      | 'WITHDRAWN_PARTICIPANT'
      | null;
    createdFromRequestId: string;
    createdFromRequest: {
      requesterParticipantId: string;
      receiverParticipantId: string;
    };
  }>;
  conversationThreads: Array<{
    id: string;
    participantAId: string;
    participantBId: string;
    status: 'OPEN' | 'READ_ONLY' | 'ARCHIVED';
    closedReason:
      | 'ACTIVE_MATCH_CREATED'
      | 'ROOM_SELECTION_CUTOFF'
      | 'SEASON_ENDED'
      | 'PARTICIPANT_WITHDRAWN'
      | 'MODERATION'
      | 'ADMIN_ACTION'
      | null;
    closedAt: Date | null;
    lastMessageAt: Date | null;
    updatedAt: Date;
  }>;
}

interface PairThreadSnapshot {
  hadConversation: boolean;
  latestClosedReason:
    | 'ACTIVE_MATCH_CREATED'
    | 'ROOM_SELECTION_CUTOFF'
    | 'SEASON_ENDED'
    | 'PARTICIPANT_WITHDRAWN'
    | 'MODERATION'
    | 'ADMIN_ACTION'
    | null;
  latestClosedAt: Date | null;
}

type DbClient = Prisma.TransactionClient | PrismaClient;

export function createMatchHistoryMaterializationOwner(prisma: PrismaService) {
  return {
    async materializeEndedSeasonHistory(
      now: Date,
      userId?: string,
    ): Promise<MatchHistoryMaterializationResult> {
      const endedSeasonIds = await findEndedSeasonIds(prisma, now, userId);
      let rebuiltEntries = 0;

      for (const seasonId of endedSeasonIds) {
        rebuiltEntries += await prisma.runSerializableTransaction(async (tx) =>
          rebuildSeasonHistoryEntries(tx, seasonId, now),
        );
      }

      return {
        processedSeasons: endedSeasonIds.length,
        rebuiltEntries,
      };
    },

    async materializeSeasonHistoryById(
      seasonId: string,
      now: Date,
    ): Promise<MatchHistoryMaterializationResult> {
      const rebuiltEntries = await prisma.runSerializableTransaction(async (tx) =>
        rebuildSeasonHistoryEntries(tx, seasonId, now),
      );

      return {
        processedSeasons: rebuiltEntries > 0 ? 1 : 0,
        rebuiltEntries,
      };
    },
  };
}

async function findEndedSeasonIds(prisma: PrismaService, now: Date, userId?: string) {
  const todayDate = new Date(`${formatKstDate(now)}T00:00:00.000Z`);
  const seasons = await prisma.season.findMany({
    where: {
      seasonEndDate: { lt: todayDate },
      participants: userId
        ? {
            some: {
              userId,
              participationIntent: 'REGISTERED',
              registeredAt: { not: null },
            },
          }
        : undefined,
    },
    orderBy: [{ seasonEndDate: 'desc' }, { academicYear: 'desc' }, { semester: 'desc' }],
    select: {
      id: true,
    },
  });

  return seasons.map((season) => season.id);
}

async function rebuildSeasonHistoryEntries(
  tx: DbClient,
  seasonId: string,
  now: Date,
): Promise<number> {
  const season = await loadSeasonHistorySource(tx, seasonId);
  if (!season) {
    return 0;
  }

  const rows = buildHistoryRows(season, now);

  await tx.seasonMatchHistoryEntry.deleteMany({
    where: {
      seasonId,
    },
  });

  if (rows.length > 0) {
    await tx.seasonMatchHistoryEntry.createMany({
      data: rows,
    });
  }

  return rows.length;
}

async function loadSeasonHistorySource(
  tx: DbClient,
  seasonId: string,
): Promise<SeasonHistorySource | null> {
  return tx.season.findUnique({
    where: { id: seasonId },
    select: {
      id: true,
      name: true,
      seasonEndDate: true,
      participants: {
        orderBy: [{ id: 'asc' }],
        select: {
          id: true,
          userId: true,
          participationIntent: true,
          registeredAt: true,
          declinedAt: true,
          participantStatus: true,
          dormitoryId: true,
          dormitorySelectionState: true,
          hiddenByAdminAt: true,
          deactivatedAt: true,
          profile: {
            select: {
              participantId: true,
              nicknameSnapshot: true,
              ...lifestyleColumnSelect,
            },
          },
          user: {
            select: {
              profile: {
                select: {
                  nickname: true,
                  ...lifestyleColumnSelect,
                },
              },
            },
          },
        },
      },
      matchRequests: {
        where: {
          status: {
            not: 'PENDING',
          },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          requesterParticipantId: true,
          receiverParticipantId: true,
          status: true,
          terminalReason: true,
          terminalAt: true,
          createdAt: true,
        },
      },
      activeMatches: {
        orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          pairKey: true,
          participantAId: true,
          participantBId: true,
          status: true,
          startedAt: true,
          endedAt: true,
          endReason: true,
          createdFromRequestId: true,
          createdFromRequest: {
            select: {
              requesterParticipantId: true,
              receiverParticipantId: true,
            },
          },
        },
      },
      conversationThreads: {
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          participantAId: true,
          participantBId: true,
          status: true,
          closedReason: true,
          closedAt: true,
          lastMessageAt: true,
          updatedAt: true,
        },
      },
    },
  });
}

function buildHistoryRows(
  season: SeasonHistorySource,
  now: Date,
): Prisma.SeasonMatchHistoryEntryCreateManyInput[] {
  const historyParticipantIds = new Set(
    season.participants
      .filter((participant) => participant.registeredAt !== null)
      .map((participant) => participant.id),
  );
  const participantMap = new Map(
    season.participants.map((participant) => [participant.id, participant] as const),
  );
  const pairThreadMap = buildPairThreadMap(season.conversationThreads);
  const seasonBoundaryAt = toSeasonEndBoundary(season.seasonEndDate, now);
  const rows: Prisma.SeasonMatchHistoryEntryCreateManyInput[] = [];

  for (const request of season.matchRequests) {
    if (request.status === 'ACCEPTED') {
      continue;
    }

    const requester = participantMap.get(request.requesterParticipantId);
    const receiver = participantMap.get(request.receiverParticipantId);
    if (!requester || !receiver) {
      continue;
    }

    if (!historyParticipantIds.has(requester.id) || !historyParticipantIds.has(receiver.id)) {
      continue;
    }

    const pairIdentity = buildParticipantPairIdentity(
      request.requesterParticipantId,
      request.receiverParticipantId,
    );
    const threadSnapshot = pairThreadMap.get(pairIdentity.pairKey);
    const finalizedAt = request.terminalAt ?? request.createdAt;

    rows.push(
      buildRequestHistoryRow({
        id: `request:${request.id}:viewer:${requester.id}`,
        seasonId: season.id,
        viewerParticipant: requester,
        counterpartParticipant: receiver,
        pairKey: pairIdentity.pairKey,
        viewerRequested: true,
        finalizedAt,
        requestTerminalReason: request.terminalReason,
        entryResult: toRequestEntryResult(request.status, request.terminalReason),
        threadSnapshot,
        sourceRequestId: request.id,
      }),
      buildRequestHistoryRow({
        id: `request:${request.id}:viewer:${receiver.id}`,
        seasonId: season.id,
        viewerParticipant: receiver,
        counterpartParticipant: requester,
        pairKey: pairIdentity.pairKey,
        viewerRequested: false,
        finalizedAt,
        requestTerminalReason: request.terminalReason,
        entryResult: toRequestEntryResult(request.status, request.terminalReason),
        threadSnapshot,
        sourceRequestId: request.id,
      }),
    );
  }

  for (const activeMatch of season.activeMatches) {
    const participantA = participantMap.get(activeMatch.participantAId);
    const participantB = participantMap.get(activeMatch.participantBId);
    if (!participantA || !participantB) {
      continue;
    }

    if (
      !historyParticipantIds.has(participantA.id) ||
      !historyParticipantIds.has(participantB.id)
    ) {
      continue;
    }

    const threadSnapshot = pairThreadMap.get(activeMatch.pairKey);
    const finalizedAt = activeMatch.endedAt ?? seasonBoundaryAt;
    const unmatchedAt =
      activeMatch.endReason && activeMatch.endReason !== 'SEASON_ENDED' ? finalizedAt : null;
    const entryResult =
      activeMatch.endReason === 'SEASON_ENDED' ||
      activeMatch.endReason === null ||
      activeMatch.status === 'ACTIVE'
        ? 'MATCHED_SUCCESS'
        : 'UNMATCHED_AFTER_SUCCESS';

    rows.push(
      buildMatchHistoryRow({
        id: `match:${activeMatch.id}:viewer:${participantA.id}`,
        seasonId: season.id,
        pairKey: activeMatch.pairKey,
        viewerParticipant: participantA,
        counterpartParticipant: participantB,
        viewerRequested: activeMatch.createdFromRequest.requesterParticipantId === participantA.id,
        createdFromRequestId: activeMatch.createdFromRequestId,
        sourceActiveMatchId: activeMatch.id,
        entryResult,
        activeMatchEndReason:
          entryResult === 'MATCHED_SUCCESS' ? 'SEASON_ENDED' : activeMatch.endReason,
        matchedAt: activeMatch.startedAt,
        unmatchedAt,
        finalizedAt,
        threadSnapshot,
      }),
      buildMatchHistoryRow({
        id: `match:${activeMatch.id}:viewer:${participantB.id}`,
        seasonId: season.id,
        pairKey: activeMatch.pairKey,
        viewerParticipant: participantB,
        counterpartParticipant: participantA,
        viewerRequested: activeMatch.createdFromRequest.requesterParticipantId === participantB.id,
        createdFromRequestId: activeMatch.createdFromRequestId,
        sourceActiveMatchId: activeMatch.id,
        entryResult,
        activeMatchEndReason:
          entryResult === 'MATCHED_SUCCESS' ? 'SEASON_ENDED' : activeMatch.endReason,
        matchedAt: activeMatch.startedAt,
        unmatchedAt,
        finalizedAt,
        threadSnapshot,
      }),
    );
  }

  return rows;
}

function buildPairThreadMap(
  threads: SeasonHistorySource['conversationThreads'],
): ReadonlyMap<string, PairThreadSnapshot> {
  const map = new Map<string, PairThreadSnapshot>();

  for (const thread of threads) {
    const pairKey = buildParticipantPairIdentity(
      thread.participantAId,
      thread.participantBId,
    ).pairKey;
    const existing = map.get(pairKey);
    const hadConversation = thread.lastMessageAt !== null;
    if (!existing) {
      map.set(pairKey, {
        hadConversation,
        latestClosedReason: thread.closedReason,
        latestClosedAt: thread.closedAt,
      });
      continue;
    }

    map.set(pairKey, {
      hadConversation: existing.hadConversation || hadConversation,
      latestClosedReason: existing.latestClosedReason,
      latestClosedAt: existing.latestClosedAt,
    });
  }

  return map;
}

function buildRequestHistoryRow(input: {
  id: string;
  seasonId: string;
  viewerParticipant: SeasonHistorySource['participants'][number];
  counterpartParticipant: SeasonHistorySource['participants'][number];
  pairKey: string;
  viewerRequested: boolean;
  finalizedAt: Date;
  requestTerminalReason:
    | 'ACCEPTED'
    | 'REJECTED_BY_RECEIVER'
    | 'CANCELLED_BY_REQUESTER'
    | 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH'
    | 'EXPIRED'
    | 'WITHDRAWN_PARTICIPANT'
    | 'ADMIN_ACTION'
    | null;
  entryResult:
    | 'REQUEST_REJECTED'
    | 'REQUEST_CANCELLED'
    | 'REQUEST_EXPIRED'
    | 'MATCHED_SUCCESS'
    | 'UNMATCHED_AFTER_SUCCESS';
  threadSnapshot: PairThreadSnapshot | undefined;
  sourceRequestId: string;
}): Prisma.SeasonMatchHistoryEntryCreateManyInput {
  const scoreSnapshot = buildHistoryScoreSnapshot(
    input.viewerParticipant,
    input.counterpartParticipant,
  );

  return {
    id: input.id,
    seasonId: input.seasonId,
    viewerParticipantId: input.viewerParticipant.id,
    counterpartParticipantId: input.counterpartParticipant.id,
    pairKey: input.pairKey,
    entryType: 'REQUEST',
    entryResult: input.entryResult,
    viewerRequested: input.viewerRequested,
    sourceRequestId: input.sourceRequestId,
    matchScore: scoreSnapshot.matchScore,
    ...toHistorySnapshotColumns(scoreSnapshot),
    counterpartNicknameSnapshot: resolveCounterpartNickname(input.counterpartParticipant),
    viewerDormitoryIdSnapshot: input.viewerParticipant.dormitoryId,
    hadConversation: input.threadSnapshot?.hadConversation ?? false,
    matchedAt: null,
    unmatchedAt: null,
    finalizedAt: input.finalizedAt,
    requestTerminalReason: input.requestTerminalReason,
    activeMatchEndReason: null,
    threadClosedReason: input.threadSnapshot?.latestClosedReason ?? null,
    threadClosedAt: input.threadSnapshot?.latestClosedAt ?? null,
  };
}

function buildMatchHistoryRow(input: {
  id: string;
  seasonId: string;
  pairKey: string;
  viewerParticipant: SeasonHistorySource['participants'][number];
  counterpartParticipant: SeasonHistorySource['participants'][number];
  viewerRequested: boolean;
  createdFromRequestId: string;
  sourceActiveMatchId: string;
  entryResult: 'MATCHED_SUCCESS' | 'UNMATCHED_AFTER_SUCCESS';
  activeMatchEndReason:
    | 'UNMATCHED_BY_MUTUAL_CONSENT'
    | 'SEASON_ENDED'
    | 'ADMIN_ACTION'
    | 'WITHDRAWN_PARTICIPANT'
    | null;
  matchedAt: Date;
  unmatchedAt: Date | null;
  finalizedAt: Date;
  threadSnapshot: PairThreadSnapshot | undefined;
}): Prisma.SeasonMatchHistoryEntryCreateManyInput {
  const scoreSnapshot = buildHistoryScoreSnapshot(
    input.viewerParticipant,
    input.counterpartParticipant,
  );

  return {
    id: input.id,
    seasonId: input.seasonId,
    viewerParticipantId: input.viewerParticipant.id,
    counterpartParticipantId: input.counterpartParticipant.id,
    pairKey: input.pairKey,
    entryType: 'MATCH',
    entryResult: input.entryResult,
    viewerRequested: input.viewerRequested,
    sourceRequestId: input.createdFromRequestId,
    sourceActiveMatchId: input.sourceActiveMatchId,
    createdFromRequestId: input.createdFromRequestId,
    matchScore: scoreSnapshot.matchScore,
    ...toHistorySnapshotColumns(scoreSnapshot),
    counterpartNicknameSnapshot: resolveCounterpartNickname(input.counterpartParticipant),
    viewerDormitoryIdSnapshot: input.viewerParticipant.dormitoryId,
    hadConversation: input.threadSnapshot?.hadConversation ?? false,
    matchedAt: input.matchedAt,
    unmatchedAt: input.unmatchedAt,
    finalizedAt: input.finalizedAt,
    requestTerminalReason: 'ACCEPTED',
    activeMatchEndReason: input.activeMatchEndReason,
    threadClosedReason: input.threadSnapshot?.latestClosedReason ?? null,
    threadClosedAt: input.threadSnapshot?.latestClosedAt ?? null,
  };
}

function resolveCounterpartNickname(participant: SeasonHistorySource['participants'][number]) {
  return (
    participant.profile?.nicknameSnapshot ?? participant.user.profile?.nickname ?? '알 수 없음'
  );
}

function buildHistoryScoreSnapshot(
  viewerParticipant: SeasonHistorySource['participants'][number],
  counterpartParticipant: SeasonHistorySource['participants'][number],
) {
  const viewerLifestyle = parseParticipantLifestyle(viewerParticipant);
  const counterpartLifestyle = parseParticipantLifestyle(counterpartParticipant);
  const scoreProjection = buildDirectionalMatchScoreProjection(
    viewerLifestyle,
    counterpartLifestyle,
  );

  return {
    matchScore: scoreProjection,
    viewerConditionSnapshot: viewerLifestyle
      ? pickLifestyleFields(viewerLifestyle, ROOMMATE_CONDITION_FIELDS)
      : null,
    viewerSelfSnapshot: viewerLifestyle
      ? pickLifestyleFields(viewerLifestyle, [
          'bedtime',
          'wakeTime',
          'relationshipStyle',
          'temperatureSensitivity',
        ] as const)
      : null,
    counterpartLifestyleSnapshot: counterpartLifestyle
      ? pickLifestyleFields(counterpartLifestyle, CORE_LIFESTYLE_FIELDS)
      : null,
  };
}

function parseParticipantLifestyle(
  participant: SeasonHistorySource['participants'][number],
): LifestyleData | null {
  const rawLifestyle = participant.profile ?? participant.user.profile ?? null;
  return toLifestyleFromColumns(rawLifestyle);
}

function pickLifestyleFields<const T extends readonly (keyof LifestyleData)[]>(
  lifestyle: LifestyleData,
  fields: T,
) {
  return Object.fromEntries(fields.map((field) => [field, lifestyle[field]])) as Pick<
    LifestyleData,
    T[number]
  >;
}

function toHistorySnapshotColumns(input: ReturnType<typeof buildHistoryScoreSnapshot>) {
  return {
    viewerSmokingToleranceSnapshot: input.viewerConditionSnapshot?.smokingTolerance ?? null,
    viewerPhoneToleranceSnapshot: input.viewerConditionSnapshot?.phoneTolerance ?? null,
    viewerEarphoneExpectationSnapshot: input.viewerConditionSnapshot?.earphoneExpectation ?? null,
    viewerSleepEnvPreferenceSnapshot: input.viewerConditionSnapshot?.sleepEnvPreference ?? null,
    viewerScreenToleranceSnapshot: input.viewerConditionSnapshot?.screenTolerance ?? null,
    viewerIndoorEatingToleranceSnapshot:
      input.viewerConditionSnapshot?.indoorEatingTolerance ?? null,
    viewerCleanExpectationSnapshot: input.viewerConditionSnapshot?.cleanExpectation ?? null,
    viewerDrinkingToleranceSnapshot: input.viewerConditionSnapshot?.drinkingTolerance ?? null,
    viewerBedtimeSnapshot: input.viewerSelfSnapshot?.bedtime
      ? toStoredBedtime(input.viewerSelfSnapshot.bedtime)
      : null,
    viewerWakeTimeSnapshot: input.viewerSelfSnapshot?.wakeTime
      ? toStoredWakeTime(input.viewerSelfSnapshot.wakeTime)
      : null,
    viewerRelationshipStyleSnapshot: input.viewerSelfSnapshot?.relationshipStyle ?? null,
    viewerTemperatureSensitivitySnapshot: input.viewerSelfSnapshot?.temperatureSensitivity ?? null,
    counterpartBedtimeSnapshot: input.counterpartLifestyleSnapshot?.bedtime
      ? toStoredBedtime(input.counterpartLifestyleSnapshot.bedtime)
      : null,
    counterpartWakeTimeSnapshot: input.counterpartLifestyleSnapshot?.wakeTime
      ? toStoredWakeTime(input.counterpartLifestyleSnapshot.wakeTime)
      : null,
    counterpartSleepHabitSnapshot: input.counterpartLifestyleSnapshot?.sleepHabit ?? null,
    counterpartSleepEnvironmentSnapshot:
      input.counterpartLifestyleSnapshot?.sleepEnvironment ?? null,
    counterpartScreenUsageSnapshot: input.counterpartLifestyleSnapshot?.screenUsage ?? null,
    counterpartNoiseSensitivitySnapshot:
      input.counterpartLifestyleSnapshot?.noiseSensitivity ?? null,
    counterpartSmokingBehaviorSnapshot: input.counterpartLifestyleSnapshot?.smokingBehavior ?? null,
    counterpartIndoorEatingSnapshot: input.counterpartLifestyleSnapshot?.indoorEating ?? null,
    counterpartPhoneBehaviorSnapshot: input.counterpartLifestyleSnapshot?.phoneBehavior ?? null,
    counterpartEarphoneUsageSnapshot: input.counterpartLifestyleSnapshot?.earphoneUsage ?? null,
    counterpartCleanLevelSnapshot: input.counterpartLifestyleSnapshot?.cleanLevel ?? null,
    counterpartDrinkingFrequencySnapshot:
      input.counterpartLifestyleSnapshot?.drinkingFrequency ?? null,
    counterpartRelationshipStyleSnapshot:
      input.counterpartLifestyleSnapshot?.relationshipStyle ?? null,
    counterpartTemperatureSensitivitySnapshot:
      input.counterpartLifestyleSnapshot?.temperatureSensitivity ?? null,
  };
}

function toRequestEntryResult(
  status: SeasonHistorySource['matchRequests'][number]['status'],
  terminalReason: SeasonHistorySource['matchRequests'][number]['terminalReason'],
): 'REQUEST_REJECTED' | 'REQUEST_CANCELLED' | 'REQUEST_EXPIRED' {
  if (status === 'REJECTED' || terminalReason === 'REJECTED_BY_RECEIVER') {
    return 'REQUEST_REJECTED';
  }

  if (status === 'EXPIRED' || terminalReason === 'EXPIRED') {
    return 'REQUEST_EXPIRED';
  }

  return 'REQUEST_CANCELLED';
}

function toSeasonEndBoundary(seasonEndDate: Date, now: Date) {
  const seasonEnd = formatKstDate(seasonEndDate);
  const boundary = new Date(`${subtractDays(seasonEnd, -1)}T00:00:00+09:00`);
  return boundary.getTime() <= now.getTime() ? boundary : now;
}

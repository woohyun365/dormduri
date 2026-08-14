import type { Prisma } from '../../../generated/prisma/client.js';
import { buildParticipantPairIdentity } from '../../persistence/match-pair-identity.js';
import type {
  SeasonHistoryParticipant,
  SeasonHistorySource,
} from './ended-season-history.loader.js';
import {
  resolveHistorySystemCancellation,
  toRequestEntryResult,
  toSeasonEndBoundary,
} from './match-history-materialization.policy.js';
import {
  buildHistoryScoreSnapshot,
  toHistorySnapshotColumns,
} from './match-history-score-snapshot.builder.js';
import {
  buildMatchHistoryCompatibilitySnapshot,
  toMatchHistoryCompatibilityJson,
} from '../compatibility/match-history-compatibility.snapshot.js';

export function buildHistoryRows(
  season: SeasonHistorySource,
  now: Date,
): Prisma.SeasonMatchHistoryEntryCreateManyInput[] {
  const historyParticipantIds = new Set(
    season.participants
      .filter((participant) => participant.registeredAt !== null && participant.profile !== null)
      .map((participant) => participant.id),
  );
  const participantMap = new Map(
    season.participants.map((participant) => [participant.id, participant] as const),
  );
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
    const finalizedAt = request.terminalAt ?? request.createdAt;
    const requesterCancellation = resolveHistorySystemCancellation({
      request,
      viewerParticipantId: request.requesterParticipantId,
      counterpartParticipantId: request.receiverParticipantId,
    });
    const receiverCancellation = resolveHistorySystemCancellation({
      request,
      viewerParticipantId: request.receiverParticipantId,
      counterpartParticipantId: request.requesterParticipantId,
    });

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
        ...requesterCancellation,
        entryResult: toRequestEntryResult(request.status, request.terminalReason),
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
        ...receiverCancellation,
        entryResult: toRequestEntryResult(request.status, request.terminalReason),
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
      }),
    );
  }

  return rows;
}

export function buildRequestHistoryRow(input: {
  id: string;
  seasonId: string;
  viewerParticipant: SeasonHistoryParticipant;
  counterpartParticipant: SeasonHistoryParticipant;
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
    | 'MATCH_PRECONDITION_FAILED'
    | 'ADMIN_ACTION'
    | null;
  systemCancellationCause: 'VIEWER_MATCHED' | 'COUNTERPART_MATCHED' | null;
  systemCancellationGroupId: string | null;
  entryResult:
    | 'REQUEST_REJECTED'
    | 'REQUEST_CANCELLED'
    | 'REQUEST_EXPIRED'
    | 'MATCHED_SUCCESS'
    | 'UNMATCHED_AFTER_SUCCESS';
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
    matchedAt: null,
    unmatchedAt: null,
    finalizedAt: input.finalizedAt,
    requestTerminalReason: input.requestTerminalReason,
    systemCancellationCause: input.systemCancellationCause,
    systemCancellationGroupId: input.systemCancellationGroupId,
    activeMatchEndReason: null,
  };
}

export function buildMatchHistoryRow(input: {
  id: string;
  seasonId: string;
  pairKey: string;
  viewerParticipant: SeasonHistoryParticipant;
  counterpartParticipant: SeasonHistoryParticipant;
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
}): Prisma.SeasonMatchHistoryEntryCreateManyInput {
  const scoreSnapshot = buildHistoryScoreSnapshot(
    input.viewerParticipant,
    input.counterpartParticipant,
  );
  const compatibility = buildMatchHistoryCompatibilitySnapshot(
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
    ...(compatibility
      ? {
          compatibilitySnapshot: toMatchHistoryCompatibilityJson(
            compatibility.compatibilitySnapshot,
          ),
          compatibilitySchemaVersion: compatibility.compatibilitySchemaVersion,
        }
      : {}),
    ...toHistorySnapshotColumns(scoreSnapshot),
    counterpartNicknameSnapshot: resolveCounterpartNickname(input.counterpartParticipant),
    viewerDormitoryIdSnapshot: input.viewerParticipant.dormitoryId,
    matchedAt: input.matchedAt,
    unmatchedAt: input.unmatchedAt,
    finalizedAt: input.finalizedAt,
    requestTerminalReason: 'ACCEPTED',
    systemCancellationCause: null,
    systemCancellationGroupId: null,
    activeMatchEndReason: input.activeMatchEndReason,
  };
}

function resolveCounterpartNickname(participant: SeasonHistoryParticipant) {
  return participant.profile?.nicknameSnapshot ?? '알 수 없음';
}

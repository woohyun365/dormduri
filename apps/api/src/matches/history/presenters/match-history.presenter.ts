import type {
  MatchHistoryEntry,
  MatchHistoryResponse,
  MatchHistorySeasonFinalResult,
  MatchHistorySeasonSummary,
  MatchHistoryStage,
} from '@repo/shared/match/contract';

export interface MatchHistorySeasonRow {
  participantId: string;
  seasonId: string;
  seasonName: string;
  viewerDormitoryIdSnapshot: string | null;
}

export interface MatchHistoryEntryRow {
  id: string;
  viewerParticipantId: string;
  counterpartParticipantId: string;
  counterpartNicknameSnapshot: string;
  entryType: 'REQUEST' | 'MATCH';
  entryResult:
    | 'REQUEST_REJECTED'
    | 'REQUEST_CANCELLED'
    | 'REQUEST_EXPIRED'
    | 'MATCHED_SUCCESS'
    | 'UNMATCHED_AFTER_SUCCESS';
  viewerRequested: boolean;
  matchedAt: Date | null;
  unmatchedAt: Date | null;
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
  activeMatchEndReason:
    | 'UNMATCHED_BY_MUTUAL_CONSENT'
    | 'SEASON_ENDED'
    | 'ADMIN_ACTION'
    | 'WITHDRAWN_PARTICIPANT'
    | null;
}

export function toMatchHistoryResponse(input: {
  seasons: MatchHistorySeasonRow[];
  entries: MatchHistoryEntryRow[];
}): MatchHistoryResponse {
  const entriesByViewer = new Map<string, MatchHistoryEntryRow[]>();
  for (const entry of input.entries) {
    const rows = entriesByViewer.get(entry.viewerParticipantId) ?? [];
    rows.push(entry);
    entriesByViewer.set(entry.viewerParticipantId, rows);
  }

  return {
    items: input.seasons.map((season) =>
      toMatchHistorySeasonSummary(season, entriesByViewer.get(season.participantId) ?? []),
    ),
  };
}

function toMatchHistorySeasonSummary(
  season: MatchHistorySeasonRow,
  rows: MatchHistoryEntryRow[],
): MatchHistorySeasonSummary {
  const history = rows
    .slice()
    .sort((left, right) => {
      const finalizedDiff = right.finalizedAt.getTime() - left.finalizedAt.getTime();
      if (finalizedDiff !== 0) {
        return finalizedDiff;
      }

      const matchedDiff = (right.matchedAt?.getTime() ?? 0) - (left.matchedAt?.getTime() ?? 0);
      if (matchedDiff !== 0) {
        return matchedDiff;
      }

      return left.id.localeCompare(right.id);
    })
    .map(toMatchHistoryEntry);

  const sentTargets = new Set(
    rows.filter((row) => row.viewerRequested).map((row) => row.counterpartParticipantId),
  );
  const receivedTargets = new Set(
    rows.filter((row) => !row.viewerRequested).map((row) => row.counterpartParticipantId),
  );

  return {
    seasonId: season.seasonId,
    seasonName: season.seasonName,
    viewerParticipantId: season.participantId,
    viewerDormitoryIdSnapshot: season.viewerDormitoryIdSnapshot,
    finalResult: toSeasonFinalResult(rows),
    sentRequestCount: sentTargets.size,
    receivedRequestCount: receivedTargets.size,
    history,
  };
}

function toSeasonFinalResult(rows: MatchHistoryEntryRow[]): MatchHistorySeasonFinalResult {
  const latestMatchRow = rows
    .filter((row) => row.entryType === 'MATCH')
    .sort((left, right) => right.finalizedAt.getTime() - left.finalizedAt.getTime())[0];

  if (!latestMatchRow) {
    return 'NO_MATCH';
  }

  return latestMatchRow.entryResult === 'MATCHED_SUCCESS'
    ? 'MATCHED_SUCCESS'
    : 'UNMATCHED_AFTER_SUCCESS';
}

function toMatchHistoryEntry(row: MatchHistoryEntryRow): MatchHistoryEntry {
  return {
    id: row.id,
    counterpartParticipantId: row.counterpartParticipantId,
    counterpartNickname: row.counterpartNicknameSnapshot,
    stage: toStage(row),
    result: row.entryResult,
    viewerRequested: row.viewerRequested,
    matchedAt: row.matchedAt?.toISOString() ?? null,
    unmatchedAt: row.unmatchedAt?.toISOString() ?? null,
    finalizedAt: row.finalizedAt.toISOString(),
    requestTerminalReason: row.requestTerminalReason,
    systemCancellationCause: row.systemCancellationCause,
    systemCancellationGroupId: row.systemCancellationGroupId,
    activeMatchEndReason: row.activeMatchEndReason,
  };
}

function toStage(row: MatchHistoryEntryRow): MatchHistoryStage {
  if (row.entryType === 'MATCH') {
    return 'MATCH';
  }

  return row.viewerRequested ? 'SENT_REQUEST' : 'RECEIVED_REQUEST';
}

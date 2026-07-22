import type { ConversationStatsResponse } from '@repo/shared/chat';
import type {
  ActiveMatchEndReason,
  MatchHistoryEntry,
  MatchHistoryEntryResult,
  MatchHistoryResponse,
  MatchHistorySeasonFinalResult,
  MatchHistorySeasonSummary,
  MatchHistoryStage,
  MatchHistorySystemCancellationCause,
} from '@repo/shared/match/contract';

export const MATCH_HISTORY_SEASONS_PER_PAGE = 3;

export interface MatchingHistoryEntryView {
  readonly id: string;
  readonly stage: MatchHistoryStage;
  readonly result: MatchHistoryEntryResult;
  readonly nickname: string;
  readonly viewerRequested: boolean;
  readonly headline: string;
  readonly stageLabel: string;
  readonly directionLabel: string;
  readonly resultLabel: string;
  readonly description: string | null;
  readonly eventAt: string;
  readonly eventDateLabel: string;
  readonly matchedAt: string | null;
  readonly unmatchedAt: string | null;
  readonly finalizedAt: string;
  readonly requestTerminalReason: MatchHistoryEntry['requestTerminalReason'];
  readonly systemCancellationCause: MatchHistorySystemCancellationCause | null;
  readonly systemCancellationGroupId: string | null;
  readonly canOpenDetail: boolean;
}

export interface MatchingHistorySeasonView {
  readonly id: string;
  readonly name: string;
  readonly result: MatchHistorySeasonFinalResult;
  readonly resultLabel: string;
  readonly sentRequestCount: number;
  readonly receivedRequestCount: number;
  readonly conversationUserCount: number | null;
  readonly entries: readonly MatchingHistoryEntryView[];
}

const stageLabels: Record<MatchHistoryStage, string> = {
  SENT_REQUEST: '보낸 요청',
  RECEIVED_REQUEST: '받은 요청',
  MATCH: '확정 매칭',
};

const seasonResultLabels: Record<MatchHistorySeasonFinalResult, string> = {
  NO_MATCH: '매칭 미성사',
  MATCHED_SUCCESS: '매칭 완료',
  UNMATCHED_AFTER_SUCCESS: '매칭 미성사',
};

const activeReasonLabels: Record<ActiveMatchEndReason, string> = {
  UNMATCHED_BY_MUTUAL_CONSENT: '두 사람의 동의로 매칭이 해제되었어요.',
  SEASON_ENDED: '시즌 종료로 매칭이 마무리되었어요.',
  ADMIN_ACTION: '운영 처리로 매칭이 종료되었어요.',
  WITHDRAWN_PARTICIPANT: '참여 상태 변경으로 매칭이 종료되었어요.',
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '기록된 날짜';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(date);
}

function entryDescription(entry: MatchHistoryEntry): string | null {
  switch (entry.result) {
    case 'REQUEST_REJECTED':
      return null;
    case 'REQUEST_CANCELLED':
      switch (entry.requestTerminalReason) {
        case 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH':
          if (entry.systemCancellationCause === 'COUNTERPART_MATCHED') {
            return '상대 매칭 확정으로 정리됐어요.';
          }
          if (entry.systemCancellationCause === 'VIEWER_MATCHED') {
            return '내 매칭 확정으로 정리됐어요.';
          }
          return '다른 매칭이 확정되어 요청이 자동으로 종료되었어요.';
        case 'WITHDRAWN_PARTICIPANT':
          return '시즌 참여 취소 요청이 종료됐어요.';
        case 'MATCH_PRECONDITION_FAILED':
          return '매칭 참여 조건이 충족되지 않아 요청이 종료됐어요.';
        case 'ADMIN_ACTION':
          return '운영 처리로 요청이 종료되었어요.';
        default:
          return null;
      }
    case 'REQUEST_EXPIRED':
      return null;
    case 'MATCHED_SUCCESS':
      return null;
    case 'UNMATCHED_AFTER_SUCCESS':
      return entry.activeMatchEndReason
        ? activeReasonLabels[entry.activeMatchEndReason]
        : '매칭 후 해제된 기록이에요.';
  }
}

function counterpartDisplayName(nickname: string): string {
  return nickname.endsWith('님') ? nickname : `${nickname}님`;
}

function entryHeadline(entry: MatchHistoryEntry, nickname: string): string {
  const counterpart = counterpartDisplayName(nickname);

  switch (entry.result) {
    case 'REQUEST_REJECTED':
      return entry.viewerRequested
        ? `${counterpart}이 내 요청을 거절했어요`
        : `${counterpart}의 요청을 거절했어요`;
    case 'REQUEST_CANCELLED':
      if (entry.requestTerminalReason === 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH') {
        return entry.viewerRequested
          ? `${counterpart}에게 보낸 요청이 자동으로 종료되었어요`
          : `${counterpart}의 요청이 자동으로 종료되었어요`;
      }
      return entry.viewerRequested
        ? `${counterpart}에게 보낸 요청을 취소했어요`
        : `${counterpart}이 요청을 취소했어요`;
    case 'REQUEST_EXPIRED':
      return entry.viewerRequested
        ? `${counterpart}에게 보낸 요청이 만료됐어요`
        : `${counterpart}의 요청이 만료됐어요`;
    case 'MATCHED_SUCCESS':
      return `${counterpart}과 매칭되었어요`;
    case 'UNMATCHED_AFTER_SUCCESS':
      return `${counterpart}과의 매칭이 종료되었어요`;
  }
}

const resultLabels: Record<MatchHistoryEntryResult, string> = {
  REQUEST_REJECTED: '요청 거절',
  REQUEST_CANCELLED: '요청 취소',
  REQUEST_EXPIRED: '요청 만료',
  MATCHED_SUCCESS: '매칭 완료',
  UNMATCHED_AFTER_SUCCESS: '매칭 후 해제',
};

function entryResultLabel(entry: MatchHistoryEntry): string {
  if (entry.result === 'REQUEST_CANCELLED') {
    if (entry.requestTerminalReason === 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH') {
      return '요청 자동 종료';
    }
    if (
      entry.requestTerminalReason === 'WITHDRAWN_PARTICIPANT' ||
      entry.requestTerminalReason === 'MATCH_PRECONDITION_FAILED' ||
      entry.requestTerminalReason === 'ADMIN_ACTION'
    ) {
      return '요청 종료';
    }
  }
  return resultLabels[entry.result];
}

export function canOpenMatchHistoryDetail(entry: MatchHistoryEntry): boolean {
  return entry.stage === 'MATCH' && entry.result === 'MATCHED_SUCCESS';
}

export function toMatchingHistoryEntryView(entry: MatchHistoryEntry): MatchingHistoryEntryView {
  const eventDate =
    entry.result === 'MATCHED_SUCCESS'
      ? (entry.matchedAt ?? entry.finalizedAt)
      : entry.result === 'UNMATCHED_AFTER_SUCCESS'
        ? (entry.unmatchedAt ?? entry.finalizedAt)
        : entry.finalizedAt;
  const nickname = entry.counterpartNickname.trim() || '사용자';

  return {
    id: entry.id,
    stage: entry.stage,
    result: entry.result,
    nickname,
    viewerRequested: entry.viewerRequested,
    headline: entryHeadline(entry, nickname),
    stageLabel: stageLabels[entry.stage],
    directionLabel:
      entry.stage === 'MATCH' ? '매칭 상대' : entry.viewerRequested ? '보낸 요청' : '받은 요청',
    resultLabel: entryResultLabel(entry),
    description: entryDescription(entry),
    eventAt: eventDate,
    eventDateLabel: formatDate(eventDate),
    matchedAt: entry.matchedAt,
    unmatchedAt: entry.unmatchedAt,
    finalizedAt: entry.finalizedAt,
    requestTerminalReason: entry.requestTerminalReason,
    systemCancellationCause: entry.systemCancellationCause,
    systemCancellationGroupId: entry.systemCancellationGroupId,
    canOpenDetail: canOpenMatchHistoryDetail(entry),
  };
}

export function toMatchingHistorySeasonView(
  season: MatchHistorySeasonSummary,
  conversationUserCount: number | null = null,
): MatchingHistorySeasonView {
  return {
    id: season.seasonId,
    name: season.seasonName,
    result: season.finalResult,
    resultLabel: seasonResultLabels[season.finalResult],
    sentRequestCount: season.sentRequestCount,
    receivedRequestCount: season.receivedRequestCount,
    conversationUserCount,
    entries: season.history.map(toMatchingHistoryEntryView),
  };
}

export function toMatchingHistoryView(
  response: MatchHistoryResponse,
  conversationStats?: ConversationStatsResponse | null,
): readonly MatchingHistorySeasonView[] {
  const conversationCountBySeasonId = new Map(
    conversationStats?.past.map((season) => [season.seasonId, season.conversationUserCount]) ?? [],
  );

  return response.items.map((season) =>
    toMatchingHistorySeasonView(season, conversationCountBySeasonId.get(season.seasonId) ?? null),
  );
}

export function getVisibleHistorySeasonCount(total: number, pages: number): number {
  return Math.min(total, Math.max(1, pages) * MATCH_HISTORY_SEASONS_PER_PAGE);
}

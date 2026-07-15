import type {
  ActiveMatchEndReason,
  MatchHistoryEntry,
  MatchHistoryEntryResult,
  MatchHistoryResponse,
  MatchHistorySeasonFinalResult,
  MatchHistorySeasonSummary,
  MatchHistoryStage,
  MatchRequestTerminalReason,
} from '@repo/shared/match/contract';

export const MATCH_HISTORY_SEASONS_PER_PAGE = 3;

export interface MatchingHistoryEntryView {
  readonly id: string;
  readonly nickname: string;
  readonly stageLabel: string;
  readonly directionLabel: string;
  readonly resultLabel: string;
  readonly description: string;
  readonly eventLabel: string;
  readonly eventDateLabel: string;
  readonly canOpenDetail: boolean;
}

export interface MatchingHistorySeasonView {
  readonly id: string;
  readonly name: string;
  readonly resultLabel: string;
  readonly summary: string;
  readonly entries: readonly MatchingHistoryEntryView[];
}

const stageLabels: Record<MatchHistoryStage, string> = {
  SENT_REQUEST: '보낸 요청',
  RECEIVED_REQUEST: '받은 요청',
  MATCH: '확정 매칭',
};

const seasonResultLabels: Record<MatchHistorySeasonFinalResult, string> = {
  NO_MATCH: '매칭 결과 없음',
  MATCHED_SUCCESS: '매칭 완료',
  UNMATCHED_AFTER_SUCCESS: '매칭 후 해제',
};

const requestReasonLabels: Record<MatchRequestTerminalReason, string> = {
  ACCEPTED: '요청이 수락되었어요.',
  REJECTED_BY_RECEIVER: '요청이 거절되었어요.',
  CANCELLED_BY_REQUESTER: '요청이 취소되었어요.',
  CANCELLED_BY_SYSTEM_ACTIVE_MATCH: '상대의 매칭 확정으로 요청이 종료되었어요.',
  EXPIRED: '응답 기한이 지나 요청이 종료되었어요.',
  WITHDRAWN_PARTICIPANT: '참여 상태가 변경되어 요청이 종료되었어요.',
  MATCH_PRECONDITION_FAILED: '매칭 조건이 변경되어 요청이 종료되었어요.',
  ADMIN_ACTION: '운영 처리로 요청이 종료되었어요.',
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
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function entryDescription(entry: MatchHistoryEntry): string {
  switch (entry.result) {
    case 'REQUEST_REJECTED':
      return entry.requestTerminalReason
        ? requestReasonLabels[entry.requestTerminalReason]
        : '요청이 종료되었어요.';
    case 'REQUEST_CANCELLED':
      return entry.requestTerminalReason
        ? requestReasonLabels[entry.requestTerminalReason]
        : '요청이 취소되었어요.';
    case 'REQUEST_EXPIRED':
      return entry.requestTerminalReason
        ? requestReasonLabels[entry.requestTerminalReason]
        : '응답 기한이 지나 요청이 종료되었어요.';
    case 'MATCHED_SUCCESS':
      return '최종 매칭이 완료되었어요. 당시 상대 프로필을 확인할 수 있어요.';
    case 'UNMATCHED_AFTER_SUCCESS':
      return entry.activeMatchEndReason
        ? activeReasonLabels[entry.activeMatchEndReason]
        : '매칭 후 해제된 기록이에요.';
  }
}

const resultLabels: Record<MatchHistoryEntryResult, string> = {
  REQUEST_REJECTED: '요청 거절',
  REQUEST_CANCELLED: '요청 취소',
  REQUEST_EXPIRED: '요청 만료',
  MATCHED_SUCCESS: '매칭 완료',
  UNMATCHED_AFTER_SUCCESS: '매칭 후 해제',
};

export function canOpenMatchHistoryDetail(entry: MatchHistoryEntry): boolean {
  return entry.stage === 'MATCH' && entry.result === 'MATCHED_SUCCESS';
}

export function toMatchingHistoryEntryView(entry: MatchHistoryEntry): MatchingHistoryEntryView {
  const event =
    entry.result === 'MATCHED_SUCCESS'
      ? { label: '매칭일', value: entry.matchedAt ?? entry.finalizedAt }
      : entry.result === 'UNMATCHED_AFTER_SUCCESS'
        ? { label: '해제일', value: entry.unmatchedAt ?? entry.finalizedAt }
        : { label: '종료일', value: entry.finalizedAt };
  return {
    id: entry.id,
    nickname: entry.counterpartNickname.trim() || '사용자',
    stageLabel: stageLabels[entry.stage],
    directionLabel: entry.viewerRequested ? '내가 보낸 요청' : '받은 요청',
    resultLabel: resultLabels[entry.result],
    description: entryDescription(entry),
    eventLabel: event.label,
    eventDateLabel: formatDate(event.value),
    canOpenDetail: canOpenMatchHistoryDetail(entry),
  };
}

export function toMatchingHistorySeasonView(
  season: MatchHistorySeasonSummary,
): MatchingHistorySeasonView {
  return {
    id: season.seasonId,
    name: season.seasonName,
    resultLabel: seasonResultLabels[season.finalResult],
    summary: `보낸 요청 ${season.sentRequestCount}건 · 받은 요청 ${season.receivedRequestCount}건`,
    entries: season.history.map(toMatchingHistoryEntryView),
  };
}

export function toMatchingHistoryView(
  response: MatchHistoryResponse,
): readonly MatchingHistorySeasonView[] {
  return response.items.map(toMatchingHistorySeasonView);
}

export function getVisibleHistorySeasonCount(total: number, pages: number): number {
  return Math.min(total, Math.max(1, pages) * MATCH_HISTORY_SEASONS_PER_PAGE);
}

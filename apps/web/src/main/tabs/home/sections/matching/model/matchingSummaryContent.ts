import type { ActiveMatchUnmatchProgress } from '@repo/shared/match/contract';

export type MatchingSummaryStatus =
  | 'ACTIVE_MATCH'
  | 'HAS_ACTIVITY'
  | 'NO_ACTIVITY'
  | 'NOT_OPERATED'
  | 'OFF_SEASON'
  | 'SEASON_OPEN';

export interface MatchingSummaryStats {
  sentRequests: number;
  receivedRequests: number;
  activeChats: number;
  maxPending?: number;
  expiringCount?: number;
}

export interface MatchingActionContent {
  helper: string;
  sentHelper: string;
  receivedHelper: string;
  chatHelper: string;
}

export function resolveMatchingActionContent(): MatchingActionContent {
  return {
    helper: '생활패턴과 대화를 통해 서로 잘 맞는지 알아가보세요!',
    sentHelper: '수락 대기 중',
    receivedHelper: '응답 필요',
    chatHelper: '진행 중',
  };
}

export function resolveUnmatchProgressHelper(progress: ActiveMatchUnmatchProgress): string {
  if (progress.state === 'WAITING_FOR_COUNTERPART') {
    return '내 요청 대기 중';
  }
  if (progress.state === 'WAITING_FOR_ME') {
    return '상대 요청 도착';
  }
  if (progress.state === 'COMPLETED') {
    return '해제 완료';
  }
  return progress.canRequest ? '요청 가능' : '요청 닫힘';
}

export function formatProfileValue(value: string | null | undefined): string {
  if (!value) return '미입력';
  const labels: Record<string, string> = {
    NO: '비흡연',
    YES: '흡연',
    NONE: '해당 없음',
    CLOSE: '가까운 교류',
    RESPECTFUL: '적당한 거리',
    QUIET: '조용한 편',
    LATE: '늦은 편',
    EARLY: '이른 편',
  };
  return labels[value] ?? value.replaceAll('_', ' ').toLowerCase();
}

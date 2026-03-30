import type { MatchStatus } from '@/types/match';

// 정책 상수
export const MATCH_POLICY = {
  MAX_PENDING_REQUESTS: 3,
  REQUEST_TTL_HOURS: 120,
  MAX_DIRECTION_ATTEMPTS: 3,
} as const;

// 상태별 라벨
export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  PENDING: '대기 중',
  IN_CONVERSATION: '대화 중',
  ACTIVE: '매칭됨',
  EXPIRED: '만료',
  REJECTED: '매칭 불발',
  CANCELLED: '취소함',
  CONVERSATION_ENDED: '대화 종료',
  UNMATCHED: '매칭 해제',
};

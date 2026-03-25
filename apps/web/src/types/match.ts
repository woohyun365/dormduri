// 매칭 요청 상태
export type MatchStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'CANCELED' | 'EXPIRED' | 'ENDED';

// 요청 방향
export type MatchDirection = 'SENT' | 'RECEIVED';

// 매칭 요청
export interface MatchRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: MatchStatus;
  message: string | null;
  createdAt: string;
  expiresAt: string;
  rejectedAt: string | null;
}

// 현재 활성 매칭 (1인 1매칭)
export interface ActiveMatch {
  matchId: string;
  partnerUserId: string;
  partnerNickname: string;
  partnerDormitoryId: string | null;
  matchScore: number;
  matchedAt: string;
}

// 버튼 상태 머신 반환 타입
export type MatchButtonState =
  | { type: 'REQUEST'; label: '매칭 요청' }
  | { type: 'PENDING_SENT'; label: string; requestId: string; expiresAt: string }
  | { type: 'PENDING_RECEIVED'; label: string; requestId: string; expiresAt: string }
  | { type: 'MATCHED'; label: '매칭됨' }
  | { type: 'SAME_DIRECTION_BLOCKED'; label: string }
  | { type: 'ATTEMPTS_EXHAUSTED'; label: string }
  | { type: 'BLOCKED'; label: '차단됨' }
  | { type: 'OFF_SEASON'; label: '매칭 준비 중' }
  | { type: 'DIFFERENT_BUILDING'; label: '다른 건물' }
  | { type: 'SLOT_FULL'; label: '요청 한도 초과' };

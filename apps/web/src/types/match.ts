// 매칭 관계 상태 (8종)
// 의도가 다르면 상태가 다르다 — 182-matching-tab.md D-3
export type MatchStatus =
  | 'PENDING' // 신청 대기
  | 'IN_CONVERSATION' // 수락 → 대화 중
  | 'ACTIVE' // 매칭 확정 (잠금)
  | 'EXPIRED' // 5일 TTL 만료
  | 'REJECTED' // 수신자 거절
  | 'CANCELLED' // 발신자 신청 취소
  | 'CONVERSATION_ENDED' // 대화 종료 (수동/자동)
  | 'UNMATCHED'; // 매칭 해제 (양측 동의/3일 자동)

// 점수 게이팅 타입
export type MatchScoreType = 'full' | 'partial' | 'gated';

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
  acceptedAt: string | null; // PENDING → IN_CONVERSATION 시점
  resolvedAt: string | null; // 터미널 상태 진입 시점 (이력 정렬)
  resolvedBy?: string | 'system' | null;
}

// 현재 활성 매칭 (1인 1매칭)
export interface ActiveMatch {
  matchId: string;
  partnerUserId: string;
  partnerNickname: string;
  partnerDormitoryId: string | null;
  matchScore: number;
  scoreType: MatchScoreType;
  matchedAt: string;
  cancelRequestedAt: string | null; // 해제 요청 시점 (null = 정상)
  cancelRequestedBy: string | null; // 요청자 ID
}

// 버튼 상태 머신 반환 타입 (14종)
export type MatchButtonState =
  | { type: 'REQUEST'; label: '매칭 요청' }
  | { type: 'PENDING_SENT'; label: string; requestId: string; expiresAt: string }
  | { type: 'PENDING_RECEIVED'; label: string; requestId: string; expiresAt: string }
  | { type: 'MATCHED'; label: '매칭됨' }
  | { type: 'SAME_DIRECTION_BLOCKED'; label: string }
  | { type: 'ATTEMPTS_EXHAUSTED'; label: string }
  | { type: 'BLOCKED'; label: '차단됨' }
  | { type: 'NOT_OPERATED'; label: '서비스 준비 중' }
  | { type: 'OFF_SEASON'; label: '비시즌' }
  | { type: 'SEASON_OPEN'; label: '매칭 준비 중' }
  | { type: 'DIFFERENT_BUILDING'; label: '다른 건물' }
  | { type: 'SLOT_FULL'; label: '요청 한도 초과' }
  | { type: 'IN_CONVERSATION'; label: '대화 중' }
  | { type: 'CONVERSATION_ENDED_PAIR'; label: '대화 종료' }
  | { type: 'UNMATCHED_PAIR'; label: '매칭 해제됨' };

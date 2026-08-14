export type ProfileDetailMatchScoreType = 'full' | 'partial' | 'gated';

export type ProfileDetailMatchActionState =
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

export interface ProfileDetailMatchActionStyle {
  readonly label: string;
  readonly className: string;
  readonly clickable: boolean;
}

export function getProfileDetailMatchActionStyle(
  state: ProfileDetailMatchActionState,
): ProfileDetailMatchActionStyle {
  switch (state.type) {
    case 'REQUEST':
      return {
        label: state.label,
        className: 'bg-(--knu-primary) text-white hover:bg-(--knu-primary-hover)',
        clickable: true,
      };
    case 'PENDING_SENT':
      return {
        label: '요청됨',
        className: 'cursor-not-allowed bg-gray-200 text-gray-500',
        clickable: false,
      };
    case 'PENDING_RECEIVED':
      return {
        label: '수락 대기',
        className: 'cursor-not-allowed bg-orange-100 text-orange-700',
        clickable: false,
      };
    case 'MATCHED':
      return {
        label: state.label,
        className: 'cursor-not-allowed bg-green-100 text-green-700',
        clickable: false,
      };
    case 'IN_CONVERSATION':
      return {
        label: state.label,
        className: 'cursor-not-allowed bg-blue-100 text-blue-700',
        clickable: false,
      };
    case 'SAME_DIRECTION_BLOCKED':
    case 'ATTEMPTS_EXHAUSTED':
    case 'NOT_OPERATED':
    case 'OFF_SEASON':
    case 'SEASON_OPEN':
    case 'DIFFERENT_BUILDING':
    case 'SLOT_FULL':
    case 'BLOCKED':
    case 'CONVERSATION_ENDED_PAIR':
    case 'UNMATCHED_PAIR':
      return {
        label: state.label,
        className: 'cursor-not-allowed bg-gray-200 text-gray-500',
        clickable: false,
      };
  }
}

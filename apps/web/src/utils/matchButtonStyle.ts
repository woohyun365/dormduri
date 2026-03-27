import type { MatchButtonState } from '@/types/match';

export interface MatchButtonStyle {
  label: string;
  className: string;
  clickable: boolean;
}

export function getMatchButtonStyle(state: MatchButtonState): MatchButtonStyle {
  switch (state.type) {
    case 'REQUEST':
      return {
        label: state.label,
        className: 'bg-[var(--knu-primary)] text-white hover:bg-[var(--knu-primary-hover)]',
        clickable: true,
      };
    case 'PENDING_SENT':
      return {
        label: '요청됨',
        className: 'bg-gray-200 text-gray-500 cursor-not-allowed',
        clickable: false,
      };
    case 'PENDING_RECEIVED':
      return {
        label: '수락 대기',
        className: 'bg-orange-100 text-orange-700 cursor-not-allowed',
        clickable: false,
      };
    case 'MATCHED':
      return {
        label: state.label,
        className: 'bg-green-100 text-green-700 cursor-not-allowed',
        clickable: false,
      };
    case 'IN_CONVERSATION':
      return {
        label: state.label,
        className: 'bg-blue-100 text-blue-700 cursor-not-allowed',
        clickable: false,
      };
    case 'SAME_DIRECTION_BLOCKED':
    case 'ATTEMPTS_EXHAUSTED':
    case 'OFF_SEASON':
    case 'SEASON_OPEN':
    case 'DIFFERENT_BUILDING':
    case 'SLOT_FULL':
    case 'BLOCKED':
    case 'CONVERSATION_ENDED_PAIR':
    case 'UNMATCHED_PAIR':
      return {
        label: state.label,
        className: 'bg-gray-200 text-gray-500 cursor-not-allowed',
        clickable: false,
      };
  }
}

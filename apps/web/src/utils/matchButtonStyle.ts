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
    case 'REJECTED_COOLDOWN':
    case 'OFF_SEASON':
    case 'DIFFERENT_BUILDING':
    case 'SLOT_FULL':
    case 'BLOCKED':
      return {
        label: state.label,
        className: 'bg-gray-200 text-gray-500 cursor-not-allowed',
        clickable: false,
      };
  }
}

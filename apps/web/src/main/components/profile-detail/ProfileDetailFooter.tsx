import { ChevronRight } from 'lucide-react';
import {
  getProfileDetailMatchActionStyle,
  type ProfileDetailMatchActionState,
} from './model/profileDetailMatchAction';

interface ProfileDetailFooterProps {
  hideMatchButton?: boolean;
  matchButtonState?: ProfileDetailMatchActionState;
  disabled?: boolean;
  onDisabledClick?: () => void;
  onRequestMatch: () => void;
}

export function buildProfileDetailFooter({
  hideMatchButton,
  matchButtonState,
  disabled,
  onDisabledClick,
  onRequestMatch,
}: ProfileDetailFooterProps): React.ReactNode | undefined {
  if (hideMatchButton) return undefined;

  if (matchButtonState) {
    const style = getProfileDetailMatchActionStyle(matchButtonState);
    return (
      <button
        onClick={() => {
          if (style.clickable) onRequestMatch();
        }}
        disabled={!style.clickable}
        className={`w-full flex items-center justify-center gap-1 px-4 py-3 rounded-xl text-base font-semibold transition-colors ${style.className}`}
      >
        {style.label}
        {style.clickable && <ChevronRight className="w-5 h-5" />}
      </button>
    );
  }

  const handleClick = () => {
    if (disabled) {
      onDisabledClick?.();
    } else {
      onRequestMatch();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-center justify-center gap-1 px-4 py-3 rounded-xl text-base font-semibold transition-colors ${
        disabled
          ? 'bg-[(--knu-primary)] text-white opacity-40 cursor-not-allowed'
          : 'bg-[(--knu-primary)] text-white hover:bg-[(--knu-primary-hover)]'
      }`}
    >
      매칭 요청
      <ChevronRight className="w-5 h-5" />
    </button>
  );
}

import { ChevronRight } from 'lucide-react';

interface ProfileDetailFooterProps {
  hideMatchButton?: boolean;
  disabled?: boolean;
  onDisabledClick?: () => void;
  onRequestMatch: () => void;
}

export function buildProfileDetailFooter({
  hideMatchButton,
  disabled,
  onDisabledClick,
  onRequestMatch,
}: ProfileDetailFooterProps): React.ReactNode | undefined {
  if (hideMatchButton) return undefined;

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
          ? 'bg-[var(--knu-primary)] text-white opacity-40 cursor-not-allowed'
          : 'bg-[var(--knu-primary)] text-white hover:bg-[var(--knu-primary-hover)]'
      }`}
    >
      매칭 요청
      <ChevronRight className="w-5 h-5" />
    </button>
  );
}

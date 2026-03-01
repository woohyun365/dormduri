'use client';

import { Bookmark, BookmarkCheck } from 'lucide-react';

interface BookmarkToggleButtonProps {
  isBookmarked?: boolean;
  onClick: () => void;
  size?: 'sm' | 'md';
  stopPropagation?: boolean;
}

export function BookmarkToggleButton({
  isBookmarked,
  onClick,
  size = 'md',
  stopPropagation = false,
}: BookmarkToggleButtonProps) {
  const baseClass = 'w-9 h-9 flex items-center justify-center';
  const containerClass =
    size === 'md'
      ? `${baseClass} rounded-full hover:bg-[var(--knu-background-alt)] transition-colors`
      : baseClass;
  const iconClass = 'w-5 h-5';

  const handleClick = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      className={containerClass}
      aria-label={isBookmarked ? '관심목록에서 제거' : '관심목록에 추가'}
      aria-pressed={!!isBookmarked}
    >
      {isBookmarked ? (
        <BookmarkCheck className={`${iconClass} text-[var(--knu-primary)]`} />
      ) : (
        <Bookmark className={`${iconClass} text-[var(--knu-text-tertiary)]`} />
      )}
    </button>
  );
}

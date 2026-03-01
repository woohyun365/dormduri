'use client';

import { Bookmark, BookmarkCheck } from 'lucide-react';

interface BookmarkToggleButtonProps {
  isBookmarked?: boolean;
  onClick: () => void;
  size?: 'sm' | 'md';
}

export function BookmarkToggleButton({
  isBookmarked,
  onClick,
  size = 'md',
}: BookmarkToggleButtonProps) {
  const containerClass =
    size === 'sm'
      ? 'w-9 h-9 flex items-center justify-center'
      : 'w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--knu-background-alt)] transition-colors';
  const iconClass = 'w-5 h-5';

  return (
    <button
      onClick={onClick}
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

'use client';

import { useEffect, useRef } from 'react';
import { Flag, Ban } from 'lucide-react';
import { UI_LAYER } from '@/styles/layers';

interface ProfileMoreMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onReport: () => void;
  onBlock: () => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

export function ProfileMoreMenu({
  isOpen,
  onClose,
  onReport,
  onBlock,
  triggerRef,
}: ProfileMoreMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    const trigger = triggerRef?.current;

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      const restoreTarget = trigger ?? previousFocusRef.current;
      restoreTarget?.focus();
    };
  }, [isOpen, triggerRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      aria-label="프로필 메뉴"
      className="absolute right-14 top-3 bg-white rounded-xl shadow-lg border border-(--knu-border) overflow-hidden"
      style={{ zIndex: UI_LAYER.nestedBottomSheet }}
    >
      <button
        type="button"
        onClick={() => {
          onBlock();
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-(--knu-text-primary) hover:bg-[(--knu-background-alt)] transition-colors"
      >
        <Ban className="w-4 h-4 text-[(--knu-text-tertiary)]" />
        차단하기
      </button>
      <button
        type="button"
        onClick={() => {
          onReport();
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
      >
        <Flag className="w-4 h-4" />
        신고하기
      </button>
    </div>
  );
}

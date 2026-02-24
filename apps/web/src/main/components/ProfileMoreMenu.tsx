'use client';

import { useEffect, useRef } from 'react';
import { Flag, Ban } from 'lucide-react';
import { Z_INDEX } from '@/constants/ui';

interface ProfileMoreMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onReport: () => void;
  onBlock: () => void;
}

export function ProfileMoreMenu({ isOpen, onClose, onReport, onBlock }: ProfileMoreMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="프로필 메뉴"
      className="absolute right-14 top-3 bg-white rounded-xl shadow-lg border border-[var(--knu-border)] overflow-hidden"
      style={{ zIndex: Z_INDEX.bottomSheet + 1 }}
    >
      <button
        role="menuitem"
        onClick={() => {
          onBlock();
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-[var(--knu-text-primary)] hover:bg-[var(--knu-background-alt)] transition-colors"
      >
        <Ban className="w-4 h-4 text-[var(--knu-text-tertiary)]" />
        차단하기
      </button>
      <button
        role="menuitem"
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

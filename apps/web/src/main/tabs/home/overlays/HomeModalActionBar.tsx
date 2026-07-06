'use client';

import type { ReactNode } from 'react';

interface HomeModalActionBarProps {
  children: ReactNode;
}

export function HomeModalActionBar({ children }: HomeModalActionBarProps) {
  return (
    <div className="shrink-0 border-t border-(--knu-border) bg-white p-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="flex flex-col gap-2 sm:flex-row">{children}</div>
    </div>
  );
}

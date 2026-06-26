'use client';

import { createContext, useContext } from 'react';
import type { Season } from '@/main/season/seasonFallback';
import type { SeasonState } from '@repo/shared/season/runtime';

export interface SeasonContextValue {
  season: Season;
  state: SeasonState;
  isOpen: boolean;
  isMatching: boolean;
  daysUntilEnd: number;
}

const SeasonContext = createContext<SeasonContextValue | null>(null);

export function SeasonProvider({
  value,
  children,
}: {
  value: SeasonContextValue;
  children: React.ReactNode;
}) {
  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>;
}

export function useSeasonContext(): SeasonContextValue {
  const ctx = useContext(SeasonContext);
  if (!ctx) {
    throw new Error('useSeasonContext must be used within SeasonProvider');
  }
  return ctx;
}

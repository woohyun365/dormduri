'use client';

import { createContext, useContext } from 'react';
import type { SeasonState } from '@repo/shared/season/runtime';

export interface MainRuntimeSeason {
  name: string;
  roomSelectionDate: string;
}

export interface SeasonContextValue {
  season: MainRuntimeSeason;
  state: SeasonState;
  isOpen: boolean;
  isMatching: boolean;
  daysUntilEnd: number;
}

type SeasonDisplay = Pick<SeasonContextValue, 'state' | 'isOpen' | 'isMatching'>;
const SeasonContext = createContext<SeasonDisplay | null>(null);

export function SeasonProvider({
  value,
  children,
}: {
  value: SeasonDisplay;
  children: React.ReactNode;
}) {
  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>;
}

export function useSeasonContext(): SeasonDisplay {
  const ctx = useContext(SeasonContext);
  if (!ctx) {
    throw new Error('useSeasonContext must be used within SeasonProvider');
  }
  return ctx;
}

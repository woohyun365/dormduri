'use client';

import { createContext, useContext } from 'react';
import type { UserProfile } from '@/main/model/profile';
import type { MatchingNavOptions, TabId } from '@/main/model/navigation';
import type { SeasonState } from '@repo/shared/season/runtime';
import type { UseMainHomeDashboardResult } from '@/main/hooks/useMainHomeDashboard';

export type MainViewerDisplay = Readonly<
  Pick<UserProfile, 'id' | 'nickname' | 'campus' | 'gender' | 'dormitoryId' | 'dormitory'>
>;
export interface MainShellDisplay {
  readonly viewer: MainViewerDisplay;
  readonly season: {
    readonly id: string | null;
    readonly state: SeasonState | null;
    readonly isOpen: boolean;
    readonly isMatching: boolean;
  };
  readonly scopeKey: string;
  readonly campusOperated: boolean;
  readonly registered: boolean;
  readonly canEnterRoommateSearch: boolean;
  readonly navigate: (tab: TabId, selection?: MatchingNavOptions) => void;
  readonly publishMatchingBadge: (count: number) => void;
}

export const MainShellContext = createContext<MainShellDisplay | null>(null);
export const MainHomeResourceContext = createContext<UseMainHomeDashboardResult | null>(null);

export function useMainShell() {
  const value = useContext(MainShellContext);
  if (!value) throw new Error('Main destination must be inside MainRuntime');
  return value;
}

export function useMainHomeResource() {
  const value = useContext(MainHomeResourceContext);
  if (!value) throw new Error('Home must be inside MainRuntime');
  return value;
}

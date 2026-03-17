import { useMemo } from 'react';
import { getDormitoryById } from '@/constants/dormitory';
import { isDormitoryAssigned } from '@/utils/dormitory';
import { CURRENT_SEASON, isSeasonActive } from '@/constants/season';
import { LIFESTYLE_LABELS } from '@/constants/lifestyle';
import { calcMatchScore } from '@/utils/matchScore';
import { getMatchButtonState } from '@/utils/matchRequest';
import type { RoommateProfile, UserProfile } from '@/types/profile';
import type { FilterState } from '@/types/filter';
import type { MatchRequest, ActiveMatch } from '@/types/match';

export type SortMode = 'match' | 'recent';
export type ViewMode = 'all' | 'bookmarked';

interface UseRoommateListViewModelParams {
  rawProfiles: Omit<RoommateProfile, 'matchScore'>[];
  user: UserProfile;
  filters: FilterState;
  sortMode: SortMode;
  viewMode: ViewMode;
  blockedUserIds?: Set<string>;
  bookmarkedUserIds?: Set<string>;
  matchRequests: MatchRequest[];
  activeMatch: ActiveMatch | null;
}

export function useRoommateListViewModel({
  rawProfiles,
  user,
  filters,
  sortMode,
  viewMode,
  blockedUserIds,
  bookmarkedUserIds,
  matchRequests,
  activeMatch,
}: UseRoommateListViewModelParams) {
  const isUnassigned = !isDormitoryAssigned(user.dormitoryId);
  const effectiveDormId = isUnassigned ? null : user.dormitoryId;
  const dormName = effectiveDormId ? getDormitoryById(effectiveDormId)?.name : null;
  const headerTitle = isUnassigned ? '룸메이트 찾기' : `${dormName ?? ''} 룸메이트`;

  const profiles = useMemo<RoommateProfile[]>(
    () =>
      rawProfiles.map((p) => ({
        ...p,
        matchScore: calcMatchScore(user.lifestyle, p.lifestyle),
      })),
    [rawProfiles, user.lifestyle],
  );

  const filteredProfiles = useMemo(() => {
    let list = profiles;

    list = list.filter((p) => p.gender === user.gender);

    if (blockedUserIds && blockedUserIds.size > 0) {
      list = list.filter((p) => !blockedUserIds.has(p.id));
    }

    if (viewMode === 'bookmarked' && bookmarkedUserIds) {
      list = list.filter((p) => bookmarkedUserIds.has(p.id));
    }

    if (effectiveDormId && viewMode !== 'bookmarked') {
      list = list.filter((p) => p.dormitoryId === effectiveDormId);
    }

    list = list.filter((p) => {
      for (const key of Object.keys(filters) as (keyof FilterState)[]) {
        const filterVal = filters[key];
        if (filterVal === null) continue;
        if (key === 'sleepHabit' && filterVal === 'HAS') {
          if (p.lifestyle.sleepHabit === 'NONE' || p.lifestyle.sleepHabit === null) return false;
        } else if (p.lifestyle[key] !== filterVal) {
          return false;
        }
      }
      return true;
    });

    if (sortMode === 'match') {
      list = [...list].sort((a, b) => b.matchScore - a.matchScore);
    }

    return list;
  }, [
    profiles,
    user.gender,
    effectiveDormId,
    filters,
    sortMode,
    blockedUserIds,
    viewMode,
    bookmarkedUserIds,
  ]);

  const activeFilters = (Object.entries(filters) as [keyof FilterState, string | null][]).filter(
    ([, v]) => v !== null,
  );
  const activeFilterCount = activeFilters.length;

  const getFilterLabel = (field: keyof FilterState, value: string): string => {
    if (field === 'sleepHabit' && value === 'HAS') return '있음';
    return LIFESTYLE_LABELS[field][value] ?? value;
  };

  const normalizeDormId = (id: string | null) => (isDormitoryAssigned(id) ? id : null);

  const getButtonState = (profile: RoommateProfile) =>
    getMatchButtonState({
      currentUserId: user.id,
      targetUserId: profile.id,
      targetDormitoryId: normalizeDormId(profile.dormitoryId),
      userDormitoryId: normalizeDormId(user.dormitoryId),
      requests: matchRequests,
      activeMatch,
      blockedUserIds: blockedUserIds ?? new Set(),
      isSeasonActive: isSeasonActive(CURRENT_SEASON),
    });

  return {
    filteredProfiles,
    isUnassigned,
    headerTitle,
    dormName,
    activeFilters,
    activeFilterCount,
    getFilterLabel,
    getButtonState,
  };
}

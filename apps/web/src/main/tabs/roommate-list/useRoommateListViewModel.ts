import { useMemo, useState } from 'react';
import { getDormitoryById } from '@/constants/dormitory';
import { isDormitoryAssigned } from '@/utils/dormitory';
import { LIFESTYLE_LABELS } from '@/constants/lifestyle';
import { calcMatchScoreWithGating } from '@/utils/matchScore';
import type { MatchScoreType } from '@/utils/matchScore';
import { getMatchButtonState } from '@/utils/matchRequest';
import type { RoommateProfile, UserProfile } from '@/types/profile';
import type { FilterState } from '@/types/filter';
import type { MatchRequest, ActiveMatch } from '@/types/match';

export type SortMode = 'match' | 'recent';
export type ViewMode = 'all' | 'bookmarked';

export type ScoredProfile = RoommateProfile & { scoreType: MatchScoreType };

interface UseRoommateListViewModelParams {
  rawProfiles: Omit<RoommateProfile, 'matchScore'>[];
  user: UserProfile;
  filters: FilterState;
  sortMode: SortMode;
  viewMode: ViewMode;
  isCampusOperated: boolean;
  blockedUserIds?: Set<string>;
  bookmarkedUserIds?: Set<string>;
  matchRequests: MatchRequest[];
  activeMatch: ActiveMatch | null;
  isSeasonMatching: boolean;
}

/** 시드 기반 의사 난수 (mulberry32) */
function mulberry32(seed: number) {
  let s = seed | 0;
  return (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 배열을 시드 기반으로 셔플 (Fisher-Yates) */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  const rng = mulberry32(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export function useRoommateListViewModel({
  rawProfiles,
  user,
  filters,
  sortMode,
  viewMode,
  isCampusOperated,
  blockedUserIds,
  bookmarkedUserIds,
  matchRequests,
  activeMatch,
  isSeasonMatching,
}: UseRoommateListViewModelParams) {
  // 미완성 유저 대체 정렬용 시드 (마운트마다 새 값 → 방문마다 순서 변경)
  const [shuffleSeed] = useState(() => Date.now());

  const isUnassigned = !isDormitoryAssigned(user.dormitoryId);
  const effectiveDormId = isUnassigned ? null : user.dormitoryId;
  const dormName = effectiveDormId ? getDormitoryById(effectiveDormId)?.name : null;
  const headerTitle = isUnassigned ? '룸메이트 찾기' : `${dormName ?? ''} 룸메이트`;

  const profiles = useMemo<ScoredProfile[]>(
    () =>
      rawProfiles.map((p) => {
        const result = calcMatchScoreWithGating(user.lifestyle, p.lifestyle);
        return {
          ...p,
          matchScore: result.score ?? 0,
          scoreType: result.type,
        };
      }),
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

    // 건물 필터는 profileApi가 시즌 기반으로 처리 (D-2 결정)
    // ViewModel에서 별도 건물 필터 불필요

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
      // 내가 gated → 랜덤 (시간 기반 시드)
      const isUserGated = profiles.length > 0 && profiles[0]!.scoreType === 'gated';
      if (isUserGated) {
        list = seededShuffle(list, shuffleSeed);
      } else {
        // 완성 유저: full/partial 점수순, gated 최하위
        list = [...list].sort((a, b) => {
          if (a.scoreType === 'gated' && b.scoreType !== 'gated') return 1;
          if (a.scoreType !== 'gated' && b.scoreType === 'gated') return -1;
          return b.matchScore - a.matchScore;
        });
      }
    }

    return list;
  }, [
    profiles,
    user.gender,
    filters,
    sortMode,
    blockedUserIds,
    viewMode,
    bookmarkedUserIds,
    shuffleSeed,
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
      isCampusOperated,
      isSeasonMatching,
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

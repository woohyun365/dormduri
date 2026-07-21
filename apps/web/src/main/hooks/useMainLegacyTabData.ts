import { useCallback, useEffect, useState } from 'react';
import { UNASSIGNED_ID } from '@/constants/dormitory';
import { legacyProfileApi as profileApi } from '@/main/legacy/profileLegacyClient';
import { seasonApi } from '@/main/legacy/seasonLegacyClient';
import type { Season } from '@/main/season/seasonFallback';
import type { RoommateProfile, UserProfile } from '@/types/profile';
import type { SeasonState } from '@repo/shared/season/runtime';

const MAIN_LEGACY_DATA_ERROR_MESSAGE = '탭 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.';

type MainLegacyTabDataStatus = 'idle' | 'loading' | 'success' | 'error';

export interface MainLegacyTabData {
  profiles: Omit<RoommateProfile, 'matchScore'>[];
  season: Season;
  isOpen: boolean;
  isMatching: boolean;
  daysUntilEnd: number;
  seasonState: SeasonState;
}

interface UseMainLegacyTabDataInput {
  enabled: boolean;
  currentUser: Pick<UserProfile, 'campus' | 'gender'>;
  currentDormitoryId: string | null;
}

interface MainLegacyTabDataState {
  data: MainLegacyTabData | null;
  status: MainLegacyTabDataStatus;
  error: string | null;
}

type CurrentSeasonResult = NonNullable<Awaited<ReturnType<typeof seasonApi.getCurrentSeason>>>;

function toEmptyOffSeasonData(): CurrentSeasonResult {
  return {
    season: {
      name: '',
      roomSelectionDate: '',
    },
    state: 'OFF_SEASON',
    isOpen: false,
    isMatching: false,
    isPostMatch: false,
    daysUntilEnd: 0,
  };
}

export function useMainLegacyTabData({
  enabled,
  currentUser,
  currentDormitoryId,
}: UseMainLegacyTabDataInput) {
  const [retryKey, setRetryKey] = useState(0);
  const [state, setState] = useState<MainLegacyTabDataState>({
    data: null,
    status: 'idle',
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      return () => {
        cancelled = true;
      };
    }

    async function load() {
      setState((previous) => ({ ...previous, status: 'loading', error: null }));

      try {
        const seasonResult = await seasonApi.getCurrentSeason();
        if (cancelled) return;

        const season = seasonResult ?? toEmptyOffSeasonData();
        const isUnassignedId = currentDormitoryId === UNASSIGNED_ID;
        const dormitoryIdForFilter =
          season.isOpen || season.isMatching ? (isUnassignedId ? null : currentDormitoryId) : null;
        const profiles =
          (season.isOpen || season.isMatching) && isUnassignedId
            ? []
            : await profileApi.getProfiles(
                currentUser.campus,
                currentUser.gender,
                dormitoryIdForFilter,
              );
        if (cancelled) return;

        setState({
          data: {
            profiles,
            season: season.season,
            isOpen: season.isOpen,
            isMatching: season.isMatching,
            daysUntilEnd: season.daysUntilEnd,
            seasonState: season.state,
          },
          status: 'success',
          error: null,
        });
      } catch {
        if (!cancelled) {
          setState((previous) => ({
            data: previous.data,
            status: 'error',
            error: MAIN_LEGACY_DATA_ERROR_MESSAGE,
          }));
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [currentDormitoryId, currentUser.campus, currentUser.gender, enabled, retryKey]);

  const retry = useCallback(() => {
    setRetryKey((value) => value + 1);
  }, []);

  return {
    data: state.data,
    loading: enabled && (state.status === 'idle' || state.status === 'loading'),
    error: enabled ? state.error : null,
    retry,
  };
}

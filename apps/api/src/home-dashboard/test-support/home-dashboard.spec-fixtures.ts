import type {
  HomeDashboardNextSeasonPreview,
  HomeDashboardSeasonHistorySummary,
} from '@repo/shared/home';
import type { CurrentUserResponse } from '@repo/shared/user';
import type { SeasonState } from '@repo/shared/season/runtime';
import type { CurrentSeasonContext } from '../../seasons/ports/season-context.port.js';

export function makeCurrentUserResponse(
  overrides: {
    campusOperated?: boolean;
    seasonState?: SeasonState | null;
    registered?: boolean;
    dormitoryId?: string | null;
  } = {},
): CurrentUserResponse {
  const campusOperated = overrides.campusOperated ?? true;
  const seasonState =
    overrides.seasonState === undefined ? 'SEASON_MATCHING' : overrides.seasonState;
  const registered = overrides.registered ?? true;
  const dormitoryId = overrides.dormitoryId === undefined ? 'dasan' : overrides.dormitoryId;

  return {
    user: {
      id: 'user-1',
      email: 'user1@kangwon.ac.kr',
      nickname: '감자룸메',
      gender: 'M',
      campus: 'CHUNCHEON',
    },
    displayIdentity: {
      userId: 'user-1',
      nickname: '감자룸메',
      nicknameSource: 'USER_DISPLAY_IDENTITY',
      nicknameChangedAt: null,
    },
    academicIdentity: {
      collegeCode: 'IT',
      birthYear: 2002,
    },
    seasonProfile: {
      hasCurrentSeason: Boolean(seasonState),
      hasParticipantRow: Boolean(seasonState),
      intent: registered ? 'REGISTERED' : 'UNDECIDED',
      registered,
      profileExists: registered,
      profileState: registered ? 'REGISTRATION_FINALIZED' : 'NONE',
      completion: {
        profileCompletionRequired: !registered,
        dormitorySelectionRequired: !registered,
        registrationUnavailable: !registered,
        registrationUnavailableReasons: registered ? [] : ['PROFILE_INCOMPLETE'],
      },
      draftWritable: !registered,
      canSelectDormitory: !registered,
      canFinalizeRegistration: !registered,
    },
    selection: {
      state: dormitoryId ? 'ASSIGNED' : 'NOT_SELECTED',
      dormitoryId,
      source: 'SEASON_PARTICIPANT',
    },
    match: {
      hasActiveMatch: false,
      activeMatch: null,
    },
    capabilities: {
      canEnterRoommateSearch:
        campusOperated &&
        (seasonState === 'SEASON_OPEN' ||
          seasonState === 'SEASON_MATCHING' ||
          seasonState === 'SEASON_POST_MATCH'),
      canCreateOrUpdateSeasonProfileDraft: !registered,
      canSelectDormitory: !registered,
      canFinalizeSeasonRegistration: !registered,
      canEditDisplayIdentity: true,
      displayIdentityEditUnavailableReasons: [],
      canEditAcademicIdentity: !registered,
      academicIdentityEditUnavailableReasons: registered
        ? ['CURRENT_SEASON_REGISTRATION_LOCK']
        : [],
      canBookmark: false,
      canRequestMatch: false,
      canStartChat: false,
    },
    onboarding: {
      dismissedNotices: [{ noticeKey: 'service-intro', dismissed: false, dismissedAt: null }],
    },
    serviceState: {
      campusOperated,
      seasonState,
    },
  };
}

export function makeSeasonContext(overrides: { state?: SeasonState } = {}): CurrentSeasonContext {
  const state = overrides.state ?? 'SEASON_MATCHING';

  return {
    campusCode: 'CHUNCHEON',
    season: {
      id: 'season-1',
      name: '2026학년도 1학기',
      preparationStartDate: '2026-02-01',
      matchingStartDate: '2026-02-10',
      seasonEndDate: '2026-03-01',
    },
    operatedDormitories: [
      { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-02-20' },
    ],
    state,
    isActive: state !== 'OFF_SEASON',
    isOpen: state === 'SEASON_OPEN',
    isMatching: state === 'SEASON_MATCHING',
    isPostMatch: state === 'SEASON_POST_MATCH',
    daysUntilMatchingEnd: state === 'SEASON_MATCHING' ? 10 : 0,
    daysUntilSeasonEnd: state !== 'OFF_SEASON' ? 20 : 0,
    schedule: {
      preparationStart: '2026-02-01',
      matchingStart: '2026-02-10',
      matchingEnd: '2026-02-20',
      seasonEnd: '2026-03-01',
    },
    override: {
      active: false,
      state: null,
      reason: null,
      startedAt: null,
      endsAt: null,
    },
  };
}

export function makeSeasonHistorySummary(): HomeDashboardSeasonHistorySummary {
  return {
    lastSeason: {
      id: 'season-previous',
      name: '2025학년도 2학기',
      totalParticipants: 120,
      totalMatchSuccess: 36,
      viewerHadRegistration: true,
      viewerHadMatchSuccess: false,
    },
  };
}

export function makeNextSeasonPreview(): HomeDashboardNextSeasonPreview {
  return {
    id: 'season-next',
    name: '2026학년도 2학기',
    preparationStartDate: '2026-08-01',
    matchingStartDate: '2026-08-20',
    seasonEndDate: '2026-12-20',
    visibleToUser: true,
  };
}

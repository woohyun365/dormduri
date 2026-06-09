import { SERVICE_INTRO_NOTICE_KEY, type CurrentUserResponse } from '@repo/shared/user-contract';
import type {
  UserAcademicIdentityRecord,
  UserDismissedNoticeRecord,
  UserDisplayIdentityRecord,
  UserWithDisplayIdentityRecord,
} from './current-user.select.js';

export type CurrentUserResponseUserRecord = Omit<
  UserWithDisplayIdentityRecord,
  'displayIdentity' | 'academicIdentity' | 'dismissedNotices' | 'deletedAt'
> & {
  deletedAt?: Date | null;
  displayIdentity?: UserDisplayIdentityRecord | null;
  academicIdentity?: UserAcademicIdentityRecord | null;
  dismissedNotices?: UserDismissedNoticeRecord[];
};

export function buildCurrentUserIdentitySegment(
  user: CurrentUserResponseUserRecord & {
    displayIdentity: UserDisplayIdentityRecord;
    academicIdentity: UserAcademicIdentityRecord;
  },
): Pick<CurrentUserResponse, 'user' | 'displayIdentity' | 'academicIdentity'> {
  return {
    user: {
      id: user.id,
      email: user.email,
      nickname: user.displayIdentity.nickname,
      gender: user.gender,
      campus: user.campus,
    },
    displayIdentity: {
      userId: user.displayIdentity.userId,
      nickname: user.displayIdentity.nickname,
      nicknameSource: 'USER_DISPLAY_IDENTITY',
      nicknameChangedAt: toNullableIsoDateTime(user.displayIdentity.nicknameChangedAt),
    },
    academicIdentity: {
      collegeCode: user.academicIdentity.collegeCode as NonNullable<
        CurrentUserResponse['academicIdentity']
      >['collegeCode'],
      birthYear: user.academicIdentity.birthYear,
    },
  };
}

export function buildCurrentUserMatchSegment(
  activeMatch: CurrentUserResponse['match']['activeMatch'],
): CurrentUserResponse['match'] {
  return {
    hasActiveMatch: activeMatch !== null,
    activeMatch,
  };
}

export function buildCurrentUserCapabilitySegment(
  serviceState: {
    campusOperated: boolean;
    seasonState: CurrentUserResponse['serviceState']['seasonState'];
  },
  seasonSegment: Pick<CurrentUserResponse, 'seasonProfile'> & {
    capabilities: Pick<
      CurrentUserResponse['capabilities'],
      'canCreateOrUpdateSeasonProfileDraft' | 'canSelectDormitory' | 'canFinalizeSeasonRegistration'
    >;
  },
  displayIdentityEditUnavailableReasons: CurrentUserResponse['capabilities']['displayIdentityEditUnavailableReasons'],
): CurrentUserResponse['capabilities'] {
  return {
    canEnterRoommateSearch:
      serviceState.campusOperated &&
      (serviceState.seasonState === 'SEASON_OPEN' ||
        serviceState.seasonState === 'SEASON_MATCHING' ||
        serviceState.seasonState === 'SEASON_POST_MATCH'),
    canCreateOrUpdateSeasonProfileDraft:
      seasonSegment.capabilities.canCreateOrUpdateSeasonProfileDraft,
    canSelectDormitory: seasonSegment.capabilities.canSelectDormitory,
    canFinalizeSeasonRegistration: seasonSegment.capabilities.canFinalizeSeasonRegistration,
    canEditDisplayIdentity: displayIdentityEditUnavailableReasons.length === 0,
    displayIdentityEditUnavailableReasons,
    canEditAcademicIdentity: !seasonSegment.seasonProfile.registered,
    academicIdentityEditUnavailableReasons: seasonSegment.seasonProfile.registered
      ? ['CURRENT_SEASON_REGISTRATION_LOCK']
      : [],
    canBookmark: false,
    canRequestMatch: false,
    canStartChat: false,
  };
}

export function buildCurrentUserOnboardingSegment(
  dismissedNotices: UserDismissedNoticeRecord[],
): CurrentUserResponse['onboarding'] {
  const serviceIntroNotice = dismissedNotices.find(
    (notice) => notice.noticeKey === SERVICE_INTRO_NOTICE_KEY,
  );

  return {
    dismissedNotices: [
      {
        noticeKey: SERVICE_INTRO_NOTICE_KEY,
        dismissed: Boolean(serviceIntroNotice),
        dismissedAt: toNullableIsoDateTime(serviceIntroNotice?.dismissedAt ?? null),
      },
    ],
  };
}

export function buildCurrentUserServiceStateSegment(serviceState: {
  campusOperated: boolean;
  seasonState: CurrentUserResponse['serviceState']['seasonState'];
}): CurrentUserResponse['serviceState'] {
  return {
    campusOperated: serviceState.campusOperated,
    seasonState: serviceState.seasonState,
  };
}

function toNullableIsoDateTime(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

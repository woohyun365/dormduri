import { Injectable } from '@nestjs/common';
import { SERVICE_INTRO_NOTICE_KEY, type CurrentUserResponse } from '@repo/shared/user-contract';
import type { AuthenticatedUserContext } from '../auth/application/auth-actor-context.types.js';
import { PrismaService } from '../platform/database/prisma.service.js';
import { MatchesService } from '../matches/matches.service.js';
import { hasNicknameCooldown } from './nickname-policy.js';
import {
  buildDisplayIdentityEditUnavailableReasons,
  isNicknameLockedByCurrentSeasonRegistration,
} from './nickname-change-policy.owner.js';
import { CurrentSeasonParticipationViewOwner } from '../season-participants/current-season-participation-view.owner.js';
import {
  buildUserWithDisplayIdentitySelect,
  mapUserWithDisplayIdentityProjection,
  type UserAcademicIdentityRecord,
  type UserDismissedNoticeRecord,
  type UserDisplayIdentityRecord,
  type UserWithDisplayIdentityRecord,
} from './current-user-select.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import { resolveCampusServiceState } from './service-state.js';
import { assertUserAccountIdentity } from '../identity/account-identity-invariant.js';
import { usersErrors } from './users.errors.js';

type CurrentUserResponseUserRecord = Omit<
  UserWithDisplayIdentityRecord,
  'displayIdentity' | 'academicIdentity' | 'dismissedNotices' | 'deletedAt'
> & {
  deletedAt?: Date | null;
  displayIdentity?: UserDisplayIdentityRecord | null;
  academicIdentity?: UserAcademicIdentityRecord | null;
  dismissedNotices?: UserDismissedNoticeRecord[];
};

@Injectable()
export class CurrentUserViewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seasonsService: SeasonsService,
    private readonly currentSeasonParticipationViewOwner: CurrentSeasonParticipationViewOwner,
    private readonly matchesService: MatchesService,
  ) {}

  async getCurrentUser(authUser: AuthenticatedUserContext): Promise<CurrentUserResponse> {
    const now = await this.prisma.getDatabaseNow();
    const user = await this.getUserWithDisplayIdentity(authUser.id);
    return this.buildCurrentUserResponse(user, now);
  }

  async buildCurrentUserResponse(
    user: CurrentUserResponseUserRecord,
    now: Date,
  ): Promise<CurrentUserResponse> {
    assertUserAccountIdentity(user, (invariant) =>
      usersErrors.accountIdentityIncomplete('current-user', invariant),
    );

    const serviceState = await resolveCampusServiceState(
      this.prisma,
      this.seasonsService,
      user.campus,
      now,
    );
    const seasonSegment =
      await this.currentSeasonParticipationViewOwner.buildCurrentUserSeasonParticipationSegment({
        user: {
          id: user.id,
          emailVerifiedAt: user.emailVerifiedAt,
          gender: user.gender,
          campus: user.campus,
          deletedAt: user.deletedAt,
        },
        campusOperated: serviceState.campusOperated,
        seasonState: serviceState.seasonState,
        seasonContext: serviceState.seasonContext,
        now,
      });

    const activeMatch =
      seasonSegment.participant && serviceState.seasonContext
        ? await this.matchesService.getCurrentActiveMatchSummaryForParticipant(
            serviceState.seasonContext,
            seasonSegment.participant.id,
            now,
          )
        : null;
    const nicknameCooldownActive = hasNicknameCooldown(user.displayIdentity.nicknameChangedAt, now);
    const nicknameLockedBySeason = isNicknameLockedByCurrentSeasonRegistration({
      seasonState: serviceState.seasonState,
      participantRegistered: seasonSegment.seasonProfile.registered,
    });
    const displayIdentityEditUnavailableReasons = buildDisplayIdentityEditUnavailableReasons({
      nicknameLockedBySeason,
      nicknameCooldownActive,
    });

    const identity = buildIdentitySegment(user);

    return {
      ...identity,
      seasonProfile: seasonSegment.seasonProfile,
      selection: seasonSegment.selection,
      match: buildMatchSegment(activeMatch),
      capabilities: buildCapabilitySegment(
        serviceState,
        seasonSegment,
        displayIdentityEditUnavailableReasons,
      ),
      onboarding: buildOnboardingSegment(user.dismissedNotices ?? []),
      serviceState: buildServiceStateSegment(serviceState),
    };
  }

  private async getUserWithDisplayIdentity(userId: string): Promise<UserWithDisplayIdentityRecord> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: buildUserWithDisplayIdentitySelect(),
    });

    if (!user) {
      throw new Error('[CurrentUserViewService] authenticated user not found');
    }

    return mapUserWithDisplayIdentityProjection(user);
  }
}

function buildIdentitySegment(
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

function buildMatchSegment(
  activeMatch: CurrentUserResponse['match']['activeMatch'],
): CurrentUserResponse['match'] {
  return {
    hasActiveMatch: activeMatch !== null,
    activeMatch,
  };
}

function buildCapabilitySegment(
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

function buildOnboardingSegment(
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

function buildServiceStateSegment(serviceState: {
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

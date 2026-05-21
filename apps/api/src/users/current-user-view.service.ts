import { Injectable } from '@nestjs/common';
import {
  SERVICE_INTRO_NOTICE_KEY,
  type CurrentUserResponse,
  type DismissedNoticeState,
} from '@repo/shared/user-contract';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { MatchesService } from '../matches/matches.service.js';
import { hasNicknameCooldown } from '../profiles/nickname-policy.js';
import { CurrentSeasonParticipationViewOwner } from '../season-participants/current-season-participation-view.owner.js';
import {
  buildUserWithDisplayIdentitySelect,
  mapUserWithDisplayIdentityProjection,
  type UserDismissedNoticeRecord,
  type UserDisplayIdentityRecord,
  type UserWithDisplayIdentityRecord,
} from './current-user-select.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import { resolveCampusServiceState } from './service-state.js';
import { assertUserDisplayIdentity } from '../common/user-display-identity-invariant.js';
import { usersErrors } from './users.errors.js';

type CurrentUserResponseUserRecord = Omit<
  UserWithDisplayIdentityRecord,
  'displayIdentity' | 'dismissedNotices' | 'deletedAt'
> & {
  deletedAt?: Date | null;
  displayIdentity?: UserDisplayIdentityRecord | null;
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
    assertUserDisplayIdentity(user, () => usersErrors.accountIdentityIncomplete('current-user'));

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
    const canEditDisplayIdentity = !hasNicknameCooldown(
      user.displayIdentity.nicknameChangedAt,
      now,
    );

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
      seasonProfile: seasonSegment.seasonProfile,
      selection: seasonSegment.selection,
      match: {
        hasActiveMatch: activeMatch !== null,
        activeMatch,
      },
      capabilities: {
        canBrowseProfiles:
          serviceState.campusOperated &&
          (serviceState.seasonState === 'SEASON_OPEN' ||
            serviceState.seasonState === 'SEASON_MATCHING' ||
            serviceState.seasonState === 'SEASON_POST_MATCH'),
        canCreateOrUpdateSeasonProfileDraft:
          seasonSegment.capabilities.canCreateOrUpdateSeasonProfileDraft,
        canSelectDormitory: seasonSegment.capabilities.canSelectDormitory,
        canFinalizeSeasonRegistration: seasonSegment.capabilities.canFinalizeSeasonRegistration,
        canEditDisplayIdentity,
        canBookmark: false,
        canRequestMatch: false,
        canStartChat: false,
      },
      onboarding: {
        dismissedNotices: buildOnboardingDismissedNotices(user.dismissedNotices ?? []),
      },
      serviceState: {
        campusOperated: serviceState.campusOperated,
        seasonState: serviceState.seasonState,
      },
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

function buildOnboardingDismissedNotices(
  dismissedNotices: UserDismissedNoticeRecord[],
): DismissedNoticeState[] {
  const serviceIntroNotice = dismissedNotices.find(
    (notice) => notice.noticeKey === SERVICE_INTRO_NOTICE_KEY,
  );

  return [
    {
      noticeKey: SERVICE_INTRO_NOTICE_KEY,
      dismissed: Boolean(serviceIntroNotice),
      dismissedAt: toNullableIsoDateTime(serviceIntroNotice?.dismissedAt ?? null),
    },
  ];
}

function toNullableIsoDateTime(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

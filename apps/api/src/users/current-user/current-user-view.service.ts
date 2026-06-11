import { Inject, Injectable } from '@nestjs/common';
import type { CurrentUserResponse } from '@repo/shared/user';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import {
  MATCH_ACTIVE_VIEW_PORT,
  type MatchActiveViewPort,
} from '../../matches/application/ports/match-active-view.port.js';
import { hasNicknameCooldown } from '../identity/display/nickname-cooldown.policy.js';
import {
  buildDisplayIdentityEditUnavailableReasons,
  isNicknameLockedByCurrentSeasonRegistration,
} from '../identity/display/display-identity-edit.policy.js';
import { CurrentSeasonParticipationViewQuery } from '../../season-participants/application/current-season-participation-view.query.js';
import {
  SEASON_CONTEXT_PORT,
  type SeasonContextPort,
} from '../../seasons/ports/season-context.port.js';
import { resolveCampusServiceState } from '../../seasons/runtime/campus-service-state.query.js';
import { assertUserAccountIdentity } from '../../identity/account-identity-invariant.js';
import { accountIdentityIncompleteError } from '../../platform/http/account-identity-invariant.error.js';
import { CurrentUserQuery } from './current-user.query.js';
import {
  buildCurrentUserCapabilitySegment,
  buildCurrentUserIdentitySegment,
  buildCurrentUserMatchSegment,
  buildCurrentUserOnboardingSegment,
  buildCurrentUserServiceStateSegment,
  type CurrentUserResponseUserRecord,
} from './current-user.presenter.js';

@Injectable()
export class CurrentUserViewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentUserQuery: CurrentUserQuery,
    @Inject(SEASON_CONTEXT_PORT)
    private readonly seasonsService: SeasonContextPort,
    private readonly currentSeasonParticipationViewOwner: CurrentSeasonParticipationViewQuery,
    @Inject(MATCH_ACTIVE_VIEW_PORT)
    private readonly matchActiveView: MatchActiveViewPort,
  ) {}

  async getCurrentUser(authUser: AuthenticatedUserContext): Promise<CurrentUserResponse> {
    const now = await this.prisma.getDatabaseNow();
    const user = await this.currentUserQuery.getUserWithDisplayIdentity(authUser.id);
    return this.buildCurrentUserResponse(user, now);
  }

  async buildCurrentUserResponse(
    user: CurrentUserResponseUserRecord,
    now: Date,
  ): Promise<CurrentUserResponse> {
    assertUserAccountIdentity(user, (invariant) =>
      accountIdentityIncompleteError('current-user', invariant),
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
        ? await this.matchActiveView.getCurrentActiveMatchSummaryForParticipant(
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

    const identity = buildCurrentUserIdentitySegment(user);

    return {
      ...identity,
      seasonProfile: seasonSegment.seasonProfile,
      selection: seasonSegment.selection,
      match: buildCurrentUserMatchSegment(activeMatch),
      capabilities: buildCurrentUserCapabilitySegment(
        serviceState,
        seasonSegment,
        displayIdentityEditUnavailableReasons,
      ),
      onboarding: buildCurrentUserOnboardingSegment(user.dismissedNotices ?? []),
      serviceState: buildCurrentUserServiceStateSegment(serviceState),
    };
  }
}

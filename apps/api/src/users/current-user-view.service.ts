import { Injectable } from '@nestjs/common';
import type { CurrentUserResponse } from '@repo/shared/user-contract';
import { isSeasonProfileComplete } from '@repo/shared/lifestyle';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { MatchesService } from '../matches/matches.service.js';
import {
  parseLifestyleOrThrow,
  toAdditionalProfile,
  type UserWithProfileRecord,
} from '../profiles/profile.mapper.js';
import { hasNicknameCooldown } from '../profiles/nickname-policy.js';
import {
  buildCurrentUserCapabilities,
  canCurrentDormitoryMatch,
  hasParticipantProfile,
  isParticipantRegistered,
  requiresCurrentSeasonParticipantProfile,
  resolveCurrentUserProfileSource,
} from '../season-participants/season-participant-policy.js';
import { SeasonParticipantsService } from '../season-participants/season-participants.service.js';
import {
  buildCurrentUserCapabilityInput,
  toOperatedDormitoryIdSet,
} from '../season-participants/season-participant-gate-context.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import {
  buildUserWithProfileSelect,
  mapUserWithParticipantProjection,
} from './current-user-select.js';
import { resolveCampusServiceState } from './service-state.js';
import { buildUserReadiness } from './user-readiness.js';

@Injectable()
export class CurrentUserViewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seasonsService: SeasonsService,
    private readonly seasonParticipantsService: SeasonParticipantsService,
    private readonly matchesService: MatchesService,
  ) {}

  async getCurrentUser(authUser: AuthenticatedUserContext): Promise<CurrentUserResponse> {
    const now = await this.prisma.getDatabaseNow();
    const user = await this.getUserWithProfile(authUser.id);
    return this.buildCurrentUserResponse(user, now);
  }

  async buildCurrentUserResponse(
    user: UserWithProfileRecord,
    now: Date,
  ): Promise<CurrentUserResponse> {
    if (!user.profile) {
      throw new Error('[CurrentUserViewService] user profile row is required');
    }

    const serviceState = await resolveCampusServiceState(
      this.prisma,
      this.seasonsService,
      user.campus,
      now,
    );
    const currentParticipant =
      await this.seasonParticipantsService.ensureCurrentSeasonParticipantForUser(user, now);

    if (requiresCurrentSeasonParticipantProfile(currentParticipant, serviceState.seasonState)) {
      throw new Error(
        '[CurrentUserViewService] registered participant profile is required during current season',
      );
    }

    const activeMatch =
      currentParticipant && serviceState.seasonContext
        ? await this.matchesService.getCurrentActiveMatchSummaryForParticipant(
            serviceState.seasonContext,
            currentParticipant.id,
            now,
          )
        : null;
    const participantRegistered = isParticipantRegistered(currentParticipant);
    const canonicalSelection = this.seasonParticipantsService.selectCanonicalSelection(
      user,
      currentParticipant,
    );
    const profileSource = resolveCurrentUserProfileSource({
      campusOperated: serviceState.campusOperated,
      seasonState: serviceState.seasonState,
      participantRegistered,
      participantProfileExists: hasParticipantProfile(currentParticipant),
    });
    const canonicalProfile = this.seasonParticipantsService.selectProfileBySource(
      user.profile,
      currentParticipant?.profile ?? null,
      profileSource,
    );
    const lifestyle = parseLifestyleOrThrow(canonicalProfile.lifestyle);
    const additional = toAdditionalProfile(canonicalProfile);
    const nicknameLockedBySeason = canonicalProfile.source === 'SEASON_PARTICIPANT_PROFILE';
    const nicknameCooldownActive = hasNicknameCooldown(user.profile.nicknameChangedAt, now);
    const operatedDormitoryIds = toOperatedDormitoryIdSet(serviceState.seasonContext);
    const currentDormitoryCanMatch = canCurrentDormitoryMatch(
      serviceState.seasonContext,
      canonicalSelection.dormitoryId,
      now,
    );
    const capabilityInput = buildCurrentUserCapabilityInput({
      campusOperated: serviceState.campusOperated,
      seasonState: serviceState.seasonState,
      participant: currentParticipant,
      participantMatched: activeMatch !== null,
      seasonProfileComplete: isSeasonProfileComplete(lifestyle),
      selection: canonicalSelection,
      operatedDormitoryIds,
      currentDormitoryCanMatch,
      nicknameLockedBySeason,
      nicknameCooldownActive,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        nickname: canonicalProfile.nickname,
        gender: user.gender,
        campus: user.campus,
      },
      selection: {
        state: canonicalSelection.dormitorySelectionState,
        dormitoryId: canonicalSelection.dormitoryId,
        source: canonicalSelection.source,
      },
      profile: {
        source: canonicalProfile.source,
        lifestyle,
        intro: canonicalProfile.intro,
        messageToRoommate: canonicalProfile.messageToRoommate,
        additional,
      },
      participation: {
        hasCurrentSeason: Boolean(serviceState.seasonContext),
        hasParticipantRow: Boolean(currentParticipant),
        intent: currentParticipant?.participationIntent ?? null,
        registered: participantRegistered,
        profileExists: hasParticipantProfile(currentParticipant),
      },
      match: {
        hasActiveMatch: activeMatch !== null,
        activeMatch,
      },
      readiness: buildUserReadiness({
        lifestyle,
        intro: canonicalProfile.intro,
        messageToRoommate: canonicalProfile.messageToRoommate,
        additional,
        selectionState: canonicalSelection.dormitorySelectionState,
        canBrowseProfiles: true,
      }),
      capabilities: buildCurrentUserCapabilities(capabilityInput),
      serviceState: {
        campusOperated: serviceState.campusOperated,
        seasonState: serviceState.seasonState,
      },
    };
  }

  private async getUserWithProfile(userId: string): Promise<UserWithProfileRecord> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: buildUserWithProfileSelect(null),
    });

    if (!user) {
      throw new Error('[CurrentUserViewService] authenticated user not found');
    }

    return mapUserWithParticipantProjection(user);
  }
}

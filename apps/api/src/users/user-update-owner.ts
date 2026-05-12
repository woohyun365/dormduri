import type { CurrentUserResponse } from '@repo/shared/user-contract';
import { isSeasonProfileComplete } from '@repo/shared/lifestyle';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import { parseLifestyleOrNull, type UserWithProfileRecord } from '../profiles/profile.mapper.js';
import { hasNicknameCooldown } from '../profiles/nickname-policy.js';
import { resolveCampusServiceState } from './service-state.js';
import { ModerationService } from '../common/moderation/moderation.service.js';
import { SeasonParticipantsService } from '../season-participants/season-participants.service.js';
import {
  canCurrentDormitoryMatch,
  hasParticipantProfile,
  isParticipantRegistered,
  requiresCurrentSeasonParticipantProfile,
  resolveCurrentUserProfileSource,
  resolveCurrentUserProfileEditability,
} from '../season-participants/season-participant-policy.js';
import {
  buildCurrentUserCapabilityInput,
  toOperatedDormitoryIdSet,
} from '../season-participants/season-participant-gate-context.js';
import {
  buildUserWithProfileSelect,
  mapUserWithParticipantProjection,
} from './current-user-select.js';
import { CurrentUserViewService } from './current-user-view.service.js';
import { createUserProfilePatchOwner } from './user-profile-patch-owner.js';
import { createUserSelectionUpdateOwner } from './user-selection-update-owner.js';
import { PrismaService } from '../common/prisma/prisma.service.js';

export interface UpdateCurrentUserInput {
  selection?: {
    state: 'UNASSIGNED' | 'ASSIGNED';
    dormitoryId: string | null;
  };
  intro?: string;
  messageToRoommate?: string | null;
  additional?: {
    college?: string | null;
    grade?: string | null;
    mbti?: string | null;
    birthYear?: number | null;
  };
}

interface UserUpdateOwnerDeps {
  prisma: PrismaService;
  seasonsService: SeasonsService;
  moderationService: ModerationService;
  seasonParticipantsService: SeasonParticipantsService;
  currentUserViewService: CurrentUserViewService;
}

export function createUserUpdateOwner(deps: UserUpdateOwnerDeps) {
  async function getUserWithProfile(userId: string): Promise<UserWithProfileRecord> {
    const user = await deps.prisma.user.findUnique({
      where: { id: userId },
      select: buildUserWithProfileSelect(null),
    });

    if (!user) {
      throw new Error('[UsersService] authenticated user not found');
    }

    return mapUserWithParticipantProjection(user);
  }

  async function updateCurrentUser(
    authUser: AuthenticatedUserContext,
    input: UpdateCurrentUserInput,
  ): Promise<CurrentUserResponse> {
    const profilePatchOwner = createUserProfilePatchOwner({
      prisma: deps.prisma,
      moderationService: deps.moderationService,
    });
    const selectionUpdateOwner = createUserSelectionUpdateOwner({
      prisma: deps.prisma,
      seasonParticipantsService: deps.seasonParticipantsService,
    });
    const now = await deps.prisma.getDatabaseNow();
    const user = await getUserWithProfile(authUser.id);
    const currentParticipant =
      await deps.seasonParticipantsService.ensureCurrentSeasonParticipantForUser(user, now);
    const serviceState = await resolveCampusServiceState(
      deps.prisma,
      deps.seasonsService,
      user.campus,
      now,
    );
    const participantRegistered = isParticipantRegistered(currentParticipant);
    const canonicalSelection = deps.seasonParticipantsService.selectCanonicalSelection(
      user,
      currentParticipant,
    );
    const currentProfileSource = resolveCurrentUserProfileSource({
      campusOperated: serviceState.campusOperated,
      seasonState: serviceState.seasonState,
      participantRegistered,
      participantProfileExists: hasParticipantProfile(currentParticipant),
    });
    const canonicalProfile = user.profile
      ? deps.seasonParticipantsService.selectProfileBySource(
          user.profile,
          currentParticipant?.profile ?? null,
          currentProfileSource,
        )
      : null;
    const canonicalLifestyle = canonicalProfile
      ? parseLifestyleOrNull(canonicalProfile.lifestyle)
      : null;

    if (requiresCurrentSeasonParticipantProfile(currentParticipant, serviceState.seasonState)) {
      throw new Error(
        '[UsersService] registered participant profile is required during current season',
      );
    }

    const nicknameLockedBySeason = currentProfileSource === 'SEASON_PARTICIPANT_PROFILE';
    const nicknameCooldownActive = user.profile
      ? hasNicknameCooldown(user.profile.nicknameChangedAt, now)
      : false;
    const operatedDormitoryIds = toOperatedDormitoryIdSet(serviceState.seasonContext);
    const currentDormitoryCanMatch = canCurrentDormitoryMatch(
      serviceState.seasonContext,
      canonicalSelection.dormitoryId,
      now,
    );
    const profileEdit = resolveCurrentUserProfileEditability(
      buildCurrentUserCapabilityInput({
        campusOperated: serviceState.campusOperated,
        seasonState: serviceState.seasonState,
        participant: currentParticipant,
        participantMatched: false,
        seasonProfileComplete: canonicalLifestyle
          ? isSeasonProfileComplete(canonicalLifestyle)
          : false,
        selection: canonicalSelection,
        operatedDormitoryIds,
        currentDormitoryCanMatch,
        nicknameLockedBySeason,
        nicknameCooldownActive,
      }),
    );

    const userUpdateData: {
      dormitoryId?: string | null;
      dormitorySelectionState?: 'NOT_SELECTED' | 'UNASSIGNED' | 'ASSIGNED';
    } = {};
    const seasonParticipantUpdateData: {
      dormitoryId?: string | null;
      dormitorySelectionState?: 'NOT_SELECTED' | 'UNASSIGNED' | 'ASSIGNED';
      participantStatus?: 'DRAFT' | 'ACTIVE';
      activatedAt?: Date | null;
    } = {};

    const { profileUpdateData, seasonParticipantProfileUpdateData } =
      await profilePatchOwner.buildProfileUpdatePayloads({
        user,
        input: {
          intro: input.intro,
          messageToRoommate: input.messageToRoommate,
          additional: input.additional,
        },
        now,
        currentProfileSource,
        profileEdit,
      });

    if (input.selection) {
      selectionUpdateOwner.assertSelectionPayload(input.selection);
      await selectionUpdateOwner.applySelectionUpdate(
        user,
        currentParticipant,
        serviceState,
        now,
        input.selection,
        userUpdateData,
        seasonParticipantUpdateData,
      );
    }

    await deps.prisma.$transaction(async (tx) => {
      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.update({
          where: { id: user.id },
          data: userUpdateData,
        });
      }

      if (Object.keys(profileUpdateData).length > 0) {
        await tx.userProfile.update({
          where: { userId: user.id },
          data: profileUpdateData,
        });
      }

      if (currentParticipant && Object.keys(seasonParticipantUpdateData).length > 0) {
        await tx.seasonParticipant.update({
          where: { id: currentParticipant.id },
          data: seasonParticipantUpdateData,
        });
      }

      if (
        currentParticipant?.profile &&
        Object.keys(seasonParticipantProfileUpdateData).length > 0
      ) {
        await tx.seasonParticipantProfile.update({
          where: { participantId: currentParticipant.id },
          data: seasonParticipantProfileUpdateData,
        });
      }
    });

    return deps.currentUserViewService.buildCurrentUserResponse(
      await getUserWithProfile(authUser.id),
      now,
    );
  }

  return {
    updateCurrentUser,
  };
}

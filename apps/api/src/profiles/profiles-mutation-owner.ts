import type { CurrentUserResponse } from '@repo/shared/user-contract';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { normalizeNickname, validateNicknameFormat } from '../auth/auth.utils.js';
import { validateLifestyleData } from '../auth/lifestyle.schema.js';
import { ModerationService } from '../common/moderation/moderation.service.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import {
  canCurrentDormitoryMatch,
  hasParticipantProfile,
  isParticipantRegistered,
  requiresCurrentSeasonParticipantProfile,
  resolveCurrentUserProfileEditability,
  resolveCurrentUserProfileSource,
} from '../season-participants/season-participant-policy.js';
import { SeasonParticipantsService } from '../season-participants/season-participants.service.js';
import {
  buildCurrentUserCapabilityInput,
  toOperatedDormitoryIdSet,
} from '../season-participants/season-participant-gate-context.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import { CurrentUserViewService } from '../users/current-user-view.service.js';
import { resolveCampusServiceState } from '../users/service-state.js';
import { hasNicknameCooldown } from './nickname-policy.js';
import { profilesErrors } from './profiles.errors.js';
import { getUserWithProfile } from './profiles-owner-support.js';

interface ProfilesMutationOwnerDeps {
  prisma: PrismaService;
  seasonsService: SeasonsService;
  moderationService: ModerationService;
  seasonParticipantsService: SeasonParticipantsService;
  currentUserViewService: CurrentUserViewService;
}

export function createProfilesMutationOwner(deps: ProfilesMutationOwnerDeps) {
  async function loadEditableProfileContext(authUserId: string, now: Date) {
    const user = await getUserWithProfile(deps.prisma, authUserId);
    const currentParticipant =
      await deps.seasonParticipantsService.ensureCurrentSeasonParticipantForUser(user, now);
    const serviceState = await resolveCampusServiceState(
      deps.prisma,
      deps.seasonsService,
      user.campus,
      now,
    );
    const participantRegistered = isParticipantRegistered(currentParticipant);
    if (requiresCurrentSeasonParticipantProfile(currentParticipant, serviceState.seasonState)) {
      throw new Error(
        '[ProfilesService] registered participant profile is required during current season',
      );
    }
    const currentProfileSource = resolveCurrentUserProfileSource({
      campusOperated: serviceState.campusOperated,
      seasonState: serviceState.seasonState,
      participantRegistered,
      participantProfileExists: hasParticipantProfile(currentParticipant),
    });
    const canonicalSelection = deps.seasonParticipantsService.selectCanonicalSelection(
      user,
      currentParticipant,
    );

    return {
      user,
      currentParticipant,
      serviceState,
      currentProfileSource,
      profileEdit: resolveCurrentUserProfileEditability(
        buildCurrentUserCapabilityInput({
          campusOperated: serviceState.campusOperated,
          seasonState: serviceState.seasonState,
          participant: currentParticipant,
          participantMatched: false,
          selection: canonicalSelection,
          operatedDormitoryIds: toOperatedDormitoryIdSet(serviceState.seasonContext),
          currentDormitoryCanMatch: canCurrentDormitoryMatch(
            serviceState.seasonContext,
            canonicalSelection.dormitoryId,
            now,
          ),
          nicknameLockedBySeason: currentProfileSource === 'SEASON_PARTICIPANT_PROFILE',
          nicknameCooldownActive: user.profile
            ? hasNicknameCooldown(user.profile.nicknameChangedAt, now)
            : false,
        }),
      ),
    };
  }

  async function updateLifestyle(
    authUser: AuthenticatedUserContext,
    lifestyle: Record<string, unknown>,
  ): Promise<CurrentUserResponse> {
    const parsedLifestyle = validateLifestyleData(lifestyle);
    if (!parsedLifestyle.ok) {
      throw profilesErrors.invalidLifestyle(parsedLifestyle.error);
    }

    const now = await deps.prisma.getDatabaseNow();
    const context = await loadEditableProfileContext(authUser.id, now);

    if (
      context.currentProfileSource === 'SEASON_PARTICIPANT_PROFILE' ||
      !context.profileEdit.lifestyle
    ) {
      throw profilesErrors.profileEditLocked();
    }

    await deps.prisma.userProfile.update({
      where: { userId: authUser.id },
      data: {
        lifestyle: parsedLifestyle.value,
      },
    });

    return deps.currentUserViewService.buildCurrentUserResponse(
      await getUserWithProfile(deps.prisma, authUser.id),
      now,
    );
  }

  async function updateNickname(
    authUser: AuthenticatedUserContext,
    nickname: string,
  ): Promise<CurrentUserResponse> {
    const trimmedNickname = nickname.trim();
    const formatError = validateNicknameFormat(trimmedNickname);
    if (formatError) {
      throw profilesErrors.invalidNickname(formatError);
    }

    const now = await deps.prisma.getDatabaseNow();
    const context = await loadEditableProfileContext(authUser.id, now);

    if (
      context.currentProfileSource === 'SEASON_PARTICIPANT_PROFILE' ||
      !context.profileEdit.nickname
    ) {
      throw profilesErrors.nicknameEditLocked();
    }

    if (hasNicknameCooldown(context.user.profile?.nicknameChangedAt ?? null, now)) {
      throw profilesErrors.nicknameCooldownActive();
    }

    const nicknamePolicyError =
      await deps.moderationService.validateNicknamePolicy(trimmedNickname);
    if (nicknamePolicyError) {
      throw profilesErrors.nicknameModerationRejected(nicknamePolicyError);
    }

    const nicknameNormalized = normalizeNickname(trimmedNickname);
    const existingNickname = await deps.prisma.userProfile.findUnique({
      where: { nicknameNormalized },
      select: { userId: true },
    });

    if (existingNickname && existingNickname.userId !== authUser.id) {
      throw profilesErrors.nicknameAlreadyTaken();
    }

    await deps.prisma.userProfile.update({
      where: { userId: authUser.id },
      data: {
        nickname: trimmedNickname,
        nicknameNormalized,
        nicknameChangedAt: now,
      },
    });

    return deps.currentUserViewService.buildCurrentUserResponse(
      await getUserWithProfile(deps.prisma, authUser.id),
      now,
    );
  }

  return {
    updateLifestyle,
    updateNickname,
  };
}

import type { CurrentUserResponse } from '@repo/shared/user-contract';
import {
  CORE_LIFESTYLE_FIELDS,
  ROOMMATE_CONDITION_FIELDS,
  isSeasonProfileComplete,
} from '@repo/shared/lifestyle';
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
import { parseLifestyleOrNull } from './profile.mapper.js';
import {
  appendSeasonParticipantProfileHistorySnapshot,
  appendUserProfileHistorySnapshot,
} from './profile-history-owner.js';
import {
  toCompleteLifestyleColumnData,
  toLifestyleColumnData,
} from './profile-lifestyle.persistence.js';
import { profilesErrors } from './profiles.errors.js';
import { getUserWithProfile } from './profiles-owner-support.js';

interface ProfilesMutationOwnerDeps {
  prisma: PrismaService;
  seasonsService: SeasonsService;
  moderationService: ModerationService;
  seasonParticipantsService: SeasonParticipantsService;
  currentUserViewService: CurrentUserViewService;
}

type ParsedLifestyle = NonNullable<ReturnType<typeof parseLifestyleOrNull>>;

export function createProfilesMutationOwner(deps: ProfilesMutationOwnerDeps) {
  function pickLifestyleSubset<const SelectedFields extends readonly (keyof ParsedLifestyle)[]>(
    lifestyle: ParsedLifestyle,
    fields: SelectedFields,
  ) {
    return Object.fromEntries(fields.map((field) => [field, lifestyle[field]])) as Pick<
      ParsedLifestyle,
      SelectedFields[number]
    >;
  }

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

    return {
      user,
      currentParticipant,
      serviceState,
      currentProfileSource,
      canonicalLifestyle,
      profileEdit: resolveCurrentUserProfileEditability(
        buildCurrentUserCapabilityInput({
          campusOperated: serviceState.campusOperated,
          seasonState: serviceState.seasonState,
          participant: currentParticipant,
          participantMatched: false,
          seasonProfileComplete: canonicalLifestyle
            ? isSeasonProfileComplete(canonicalLifestyle)
            : false,
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

    if (!context.profileEdit.lifestyle) {
      throw profilesErrors.profileEditLocked();
    }

    if (context.currentProfileSource !== 'SEASON_PARTICIPANT_PROFILE') {
      if (
        !context.user.profile ||
        !context.canonicalLifestyle ||
        !hasLifestyleChanges(context.canonicalLifestyle, parsedLifestyle.value)
      ) {
        return deps.currentUserViewService.buildCurrentUserResponse(context.user, now);
      }

      await deps.prisma.$transaction(async (tx) => {
        await tx.userProfile.update({
          where: { userId: authUser.id },
          data: toLifestyleColumnData(parsedLifestyle.value),
        });

        await appendUserProfileHistorySnapshot(tx, authUser.id, 'USER_EDIT');
      });
    } else {
      if (
        context.serviceState.seasonState !== 'SEASON_OPEN' ||
        !context.currentParticipant?.profile ||
        !context.user.profile
      ) {
        throw profilesErrors.profileEditLocked();
      }

      const currentSeasonLifestyle = parseLifestyleOrNull(
        context.currentParticipant.profile.lifestyle,
      );
      const currentUserLifestyle = parseLifestyleOrNull(context.user.profile.lifestyle);
      if (!currentSeasonLifestyle || !currentUserLifestyle) {
        throw profilesErrors.invalidLifestyle('현재 저장된 생활패턴 데이터가 올바르지 않습니다.');
      }

      const attemptedCoreChange = CORE_LIFESTYLE_FIELDS.some(
        (field) => parsedLifestyle.value[field] !== currentSeasonLifestyle[field],
      );
      if (attemptedCoreChange) {
        throw profilesErrors.profileEditLocked();
      }
      if (!isSeasonProfileComplete(parsedLifestyle.value)) {
        throw profilesErrors.invalidLifestyle(
          '시즌 프로필의 생활패턴/룸메 조건은 모두 입력된 상태로만 수정할 수 있습니다.',
        );
      }

      const nextSeasonLifestyle = {
        ...currentSeasonLifestyle,
        ...pickLifestyleSubset(parsedLifestyle.value, ROOMMATE_CONDITION_FIELDS),
      };
      const nextUserLifestyle = {
        ...currentUserLifestyle,
        ...pickLifestyleSubset(parsedLifestyle.value, ROOMMATE_CONDITION_FIELDS),
      };

      const userLifestyleChanged = hasLifestyleChanges(currentUserLifestyle, nextUserLifestyle);
      const seasonLifestyleChanged = hasLifestyleChanges(
        currentSeasonLifestyle,
        nextSeasonLifestyle,
      );

      if (!userLifestyleChanged && !seasonLifestyleChanged) {
        return deps.currentUserViewService.buildCurrentUserResponse(context.user, now);
      }

      await deps.prisma.$transaction(async (tx) => {
        if (userLifestyleChanged) {
          await tx.userProfile.update({
            where: { userId: authUser.id },
            data: toLifestyleColumnData(nextUserLifestyle),
          });

          await appendUserProfileHistorySnapshot(tx, authUser.id, 'USER_EDIT');
        }

        if (seasonLifestyleChanged) {
          await tx.seasonParticipantProfile.update({
            where: { participantId: context.currentParticipant!.id },
            data: toCompleteLifestyleColumnData(nextSeasonLifestyle),
          });

          await appendSeasonParticipantProfileHistorySnapshot(
            tx,
            context.currentParticipant!.id,
            'SEASON_USER_EDIT',
          );
        }
      });
    }

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

    if (
      context.user.profile?.nickname === trimmedNickname &&
      context.user.profile.nicknameNormalized === nicknameNormalized
    ) {
      return deps.currentUserViewService.buildCurrentUserResponse(context.user, now);
    }

    await deps.prisma.$transaction(async (tx) => {
      await tx.userProfile.update({
        where: { userId: authUser.id },
        data: {
          nickname: trimmedNickname,
          nicknameNormalized,
          nicknameChangedAt: now,
        },
      });

      await appendUserProfileHistorySnapshot(tx, authUser.id, 'USER_EDIT');
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

function hasLifestyleChanges(currentLifestyle: ParsedLifestyle, nextLifestyle: ParsedLifestyle) {
  return (
    currentLifestyle.bedtime !== nextLifestyle.bedtime ||
    currentLifestyle.wakeTime !== nextLifestyle.wakeTime ||
    currentLifestyle.sleepHabit !== nextLifestyle.sleepHabit ||
    currentLifestyle.sleepEnvironment !== nextLifestyle.sleepEnvironment ||
    currentLifestyle.screenUsage !== nextLifestyle.screenUsage ||
    currentLifestyle.noiseSensitivity !== nextLifestyle.noiseSensitivity ||
    currentLifestyle.smokingBehavior !== nextLifestyle.smokingBehavior ||
    currentLifestyle.indoorEating !== nextLifestyle.indoorEating ||
    currentLifestyle.phoneBehavior !== nextLifestyle.phoneBehavior ||
    currentLifestyle.earphoneUsage !== nextLifestyle.earphoneUsage ||
    currentLifestyle.cleanLevel !== nextLifestyle.cleanLevel ||
    currentLifestyle.drinkingFrequency !== nextLifestyle.drinkingFrequency ||
    currentLifestyle.relationshipStyle !== nextLifestyle.relationshipStyle ||
    currentLifestyle.temperatureSensitivity !== nextLifestyle.temperatureSensitivity ||
    currentLifestyle.smokingTolerance !== nextLifestyle.smokingTolerance ||
    currentLifestyle.phoneTolerance !== nextLifestyle.phoneTolerance ||
    currentLifestyle.earphoneExpectation !== nextLifestyle.earphoneExpectation ||
    currentLifestyle.sleepEnvPreference !== nextLifestyle.sleepEnvPreference ||
    currentLifestyle.screenTolerance !== nextLifestyle.screenTolerance ||
    currentLifestyle.indoorEatingTolerance !== nextLifestyle.indoorEatingTolerance ||
    currentLifestyle.cleanExpectation !== nextLifestyle.cleanExpectation ||
    currentLifestyle.drinkingTolerance !== nextLifestyle.drinkingTolerance
  );
}

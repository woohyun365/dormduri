import type { CurrentUserResponse } from '@repo/shared/user-contract';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { normalizeNickname, validateNicknameFormat } from '../auth/auth.utils.js';
import { ModerationService } from '../common/moderation/moderation.service.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { profilesErrors } from '../profiles/profiles.errors.js';
import { hasNicknameCooldown } from '../profiles/nickname-policy.js';
import {
  buildUserWithDisplayIdentitySelect,
  mapUserWithDisplayIdentityProjection,
  type UserWithDisplayIdentityRecord,
} from './current-user-select.js';
import { CurrentUserViewService } from './current-user-view.service.js';
import {
  isPrismaKnownRequestError,
  prismaErrorTargetIncludes,
} from '../common/prisma/prisma-error.js';

export interface UpdateCurrentUserInput {
  displayIdentity?: {
    nickname: string;
  };
}

interface UserUpdateOwnerDeps {
  prisma: PrismaService;
  moderationService: ModerationService;
  currentUserViewService: CurrentUserViewService;
}

export function createUserUpdateOwner(deps: UserUpdateOwnerDeps) {
  async function getUserWithDisplayIdentity(
    userId: string,
  ): Promise<UserWithDisplayIdentityRecord> {
    const user = await deps.prisma.user.findUnique({
      where: { id: userId },
      select: buildUserWithDisplayIdentitySelect(),
    });

    if (!user) {
      throw new Error('[UsersService] authenticated user not found');
    }

    return mapUserWithDisplayIdentityProjection(user);
  }

  async function updateCurrentUser(
    authUser: AuthenticatedUserContext,
    input: UpdateCurrentUserInput,
  ): Promise<CurrentUserResponse> {
    const now = await deps.prisma.getDatabaseNow();
    const user = await getUserWithDisplayIdentity(authUser.id);

    if (!input.displayIdentity) {
      return deps.currentUserViewService.buildCurrentUserResponse(user, now);
    }

    const displayIdentity = user.displayIdentity;
    if (!displayIdentity) {
      throw new Error('[UsersService] user display identity row is required');
    }

    const trimmedNickname = input.displayIdentity.nickname.trim();
    const formatError = validateNicknameFormat(trimmedNickname);
    if (formatError) {
      throw profilesErrors.invalidNickname(formatError);
    }

    if (hasNicknameCooldown(displayIdentity.nicknameChangedAt, now)) {
      throw profilesErrors.nicknameCooldownActive();
    }

    const nicknamePolicyError =
      await deps.moderationService.validateNicknamePolicy(trimmedNickname);
    if (nicknamePolicyError) {
      throw profilesErrors.nicknameModerationRejected(nicknamePolicyError);
    }

    const nicknameNormalized = normalizeNickname(trimmedNickname);
    const existingNickname = await deps.prisma.userDisplayIdentity.findUnique({
      where: { nicknameNormalized },
      select: { userId: true },
    });

    if (existingNickname && existingNickname.userId !== authUser.id) {
      throw profilesErrors.nicknameAlreadyTaken();
    }

    if (
      displayIdentity.nickname === trimmedNickname &&
      displayIdentity.nicknameNormalized === nicknameNormalized
    ) {
      return deps.currentUserViewService.buildCurrentUserResponse(user, now);
    }

    try {
      const updateResult = await deps.prisma.userDisplayIdentity.updateMany({
        where: {
          userId: authUser.id,
          nicknameChangedAt: displayIdentity.nicknameChangedAt,
        },
        data: {
          nickname: trimmedNickname,
          nicknameNormalized,
          nicknameChangedAt: now,
        },
      });

      if (updateResult.count !== 1) {
        throw profilesErrors.nicknameCooldownActive();
      }
    } catch (error) {
      if (isPrismaKnownRequestError(error, 'P2002')) {
        if (prismaErrorTargetIncludes(error, 'nicknameNormalized')) {
          throw profilesErrors.nicknameAlreadyTaken();
        }
      }
      throw error;
    }

    return deps.currentUserViewService.buildCurrentUserResponse(
      await getUserWithDisplayIdentity(authUser.id),
      now,
    );
  }

  return {
    updateCurrentUser,
  };
}

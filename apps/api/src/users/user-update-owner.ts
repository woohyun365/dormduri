import type {
  CurrentUserResponse,
  UpdateCurrentUserDisplayIdentityMutationResult,
  UpdateCurrentUserResponse,
} from '@repo/shared/user-contract';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { normalizeNickname, validateNicknameFormat } from '../auth/auth.utils.js';
import { ModerationService } from '../common/moderation/moderation.service.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { hasNicknameCooldown } from './nickname-policy.js';
import {
  buildUserWithDisplayIdentitySelect,
  mapUserWithDisplayIdentityProjection,
  type UserDisplayIdentityRecord,
  type UserWithDisplayIdentityRecord,
} from './current-user-select.js';
import { CurrentUserViewService } from './current-user-view.service.js';
import {
  isPrismaKnownRequestError,
  prismaErrorTargetIncludes,
} from '../common/prisma/prisma-error.js';
import { usersErrors } from './users.errors.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import { resolveNicknameChangePolicy } from './nickname-change-policy.owner.js';

export interface UpdateCurrentUserInput {
  displayIdentity?: {
    nickname: string;
  };
}

interface UserUpdateOwnerDeps {
  prisma: PrismaService;
  seasonsService: SeasonsService;
  moderationService: ModerationService;
  currentUserViewService: CurrentUserViewService;
}

type UserReadClient = Pick<PrismaService, 'user'> | Pick<Prisma.TransactionClient, 'user'>;
type UserDisplayIdentityClient =
  | Pick<PrismaService, 'userDisplayIdentity'>
  | Pick<Prisma.TransactionClient, 'userDisplayIdentity'>;

export function createUserUpdateOwner(deps: UserUpdateOwnerDeps) {
  async function getUserWithDisplayIdentity(
    userId: string,
    client: UserReadClient = deps.prisma,
  ): Promise<UserWithDisplayIdentityRecord> {
    const user = await client.user.findUnique({
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
  ): Promise<UpdateCurrentUserResponse> {
    const now = await deps.prisma.getDatabaseNow();
    const user = await getUserWithDisplayIdentity(authUser.id);
    let displayIdentityMutation: UpdateCurrentUserDisplayIdentityMutationResult = {
      attempted: false,
      changed: false,
      noOpReason: null,
    };

    if (!input.displayIdentity) {
      return buildUpdateCurrentUserResponse(
        await deps.currentUserViewService.buildCurrentUserResponse(user, now),
        displayIdentityMutation,
      );
    }

    const parsedNickname = parseDisplayIdentityNickname(input.displayIdentity.nickname);
    displayIdentityMutation = {
      attempted: true,
      changed: false,
      noOpReason: null,
    };

    const transactionResult = await deps.prisma.runSerializableTransaction(async (tx) => {
      const txUser = await getUserWithDisplayIdentity(authUser.id, tx);
      const displayIdentity = assertDisplayIdentity(txUser.displayIdentity);

      if (isSameNickname(displayIdentity, parsedNickname)) {
        return {
          attempted: true,
          changed: false,
          noOpReason: 'SAME_NICKNAME' as const,
        };
      }

      const nicknamePolicy = await resolveNicknameChangePolicy(
        {
          prisma: deps.prisma,
          seasonsService: deps.seasonsService,
        },
        txUser,
        now,
        tx,
      );
      if (nicknamePolicy.nicknameLockedBySeason) {
        throw usersErrors.nicknameLockedBySeason();
      }

      if (hasNicknameCooldown(displayIdentity.nicknameChangedAt, now)) {
        throw usersErrors.nicknameCooldownActive();
      }

      await assertNicknamePolicyAccepted(parsedNickname.nickname);
      await assertNicknameAvailableForUser(parsedNickname, authUser.id, tx);
      await updateDisplayIdentityNickname(authUser.id, displayIdentity, parsedNickname, now, tx);

      return {
        attempted: true,
        changed: true,
        noOpReason: null,
      };
    });
    displayIdentityMutation = transactionResult;

    return buildUpdateCurrentUserResponse(
      await deps.currentUserViewService.buildCurrentUserResponse(
        await getUserWithDisplayIdentity(authUser.id),
        now,
      ),
      displayIdentityMutation,
    );
  }

  function parseDisplayIdentityNickname(nickname: string) {
    const trimmedNickname = nickname.trim();
    const formatError = validateNicknameFormat(trimmedNickname);
    if (formatError) {
      throw usersErrors.invalidNickname(formatError);
    }

    return {
      nickname: trimmedNickname,
      nicknameNormalized: normalizeNickname(trimmedNickname),
    };
  }

  async function assertNicknamePolicyAccepted(nickname: string) {
    const nicknamePolicyError = await deps.moderationService.validateNicknamePolicy(nickname);
    if (nicknamePolicyError) {
      throw usersErrors.nicknameModerationRejected(nicknamePolicyError);
    }
  }

  async function assertNicknameAvailableForUser(
    parsedNickname: { nicknameNormalized: string },
    userId: string,
    client: UserDisplayIdentityClient = deps.prisma,
  ) {
    const existingNickname = await client.userDisplayIdentity.findUnique({
      where: { nicknameNormalized: parsedNickname.nicknameNormalized },
      select: { userId: true },
    });

    if (existingNickname && existingNickname.userId !== userId) {
      throw usersErrors.nicknameAlreadyTaken();
    }
  }

  async function updateDisplayIdentityNickname(
    userId: string,
    displayIdentity: UserDisplayIdentityRecord,
    parsedNickname: { nickname: string; nicknameNormalized: string },
    now: Date,
    client: UserDisplayIdentityClient = deps.prisma,
  ) {
    try {
      const updateResult = await client.userDisplayIdentity.updateMany({
        where: {
          userId,
          nicknameChangedAt: displayIdentity.nicknameChangedAt,
        },
        data: {
          nickname: parsedNickname.nickname,
          nicknameNormalized: parsedNickname.nicknameNormalized,
          nicknameChangedAt: now,
        },
      });

      if (updateResult.count !== 1) {
        throw usersErrors.nicknameCooldownActive();
      }
    } catch (error) {
      if (isPrismaKnownRequestError(error, 'P2002')) {
        if (prismaErrorTargetIncludes(error, 'nicknameNormalized')) {
          throw usersErrors.nicknameAlreadyTaken();
        }
      }
      throw error;
    }
  }

  return {
    updateCurrentUser,
  };
}

function buildUpdateCurrentUserResponse(
  currentUser: CurrentUserResponse,
  displayIdentity: UpdateCurrentUserDisplayIdentityMutationResult,
): UpdateCurrentUserResponse {
  return {
    currentUser,
    mutation: {
      displayIdentity,
    },
  };
}

function assertDisplayIdentity(
  displayIdentity: UserWithDisplayIdentityRecord['displayIdentity'],
): UserDisplayIdentityRecord {
  if (!displayIdentity) {
    throw new Error('[UsersService] user display identity row is required');
  }
  return displayIdentity;
}

function isSameNickname(
  displayIdentity: UserDisplayIdentityRecord,
  parsedNickname: { nickname: string; nicknameNormalized: string },
) {
  return (
    displayIdentity.nickname === parsedNickname.nickname &&
    displayIdentity.nicknameNormalized === parsedNickname.nicknameNormalized
  );
}

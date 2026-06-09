import type {
  CurrentUserResponse,
  UpdateCurrentUserAcademicIdentityRequest,
  UpdateCurrentUserAcademicIdentityMutationResult,
  UpdateCurrentUserDisplayIdentityMutationResult,
  UpdateCurrentUserResponse,
} from '@repo/shared/user';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuthenticatedUserContext } from '../auth/application/auth-actor-context.types.js';
import { ModerationService } from '../moderation/moderation.service.js';
import { PrismaService } from '../platform/database/prisma.service.js';
import {
  buildUserWithDisplayIdentitySelect,
  mapUserWithDisplayIdentityProjection,
  type UserWithDisplayIdentityRecord,
} from './current-user/current-user.select.js';
import { CurrentUserViewService } from './current-user/current-user-view.service.js';
import { usersErrors } from './users.errors.js';
import type { SeasonContextPort } from '../seasons/ports/season-context.port.js';
import {
  createUpdateDisplayIdentityCommand,
  type DisplayIdentityNicknameOverrideInput,
  type DisplayIdentityNicknameOverrideResult,
} from './identity/display/update-display-identity.command.js';
import { createUpdateAcademicIdentityCommand } from './identity/academic/update-academic-identity.command.js';

export interface UpdateCurrentUserInput {
  displayIdentity?: {
    nickname: string;
  };
  academicIdentity?: UpdateCurrentUserAcademicIdentityRequest;
}

interface UserUpdateOwnerDeps {
  prisma: PrismaService;
  seasonsService: SeasonContextPort;
  moderationService: ModerationService;
  currentUserViewService: CurrentUserViewService;
}

type UserReadClient = Pick<PrismaService, 'user'> | Pick<Prisma.TransactionClient, 'user'>;

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

  const displayIdentityCommand = createUpdateDisplayIdentityCommand({
    prisma: deps.prisma,
    seasonsService: deps.seasonsService,
    moderationService: deps.moderationService,
    getUserWithDisplayIdentity,
  });
  const academicIdentityCommand = createUpdateAcademicIdentityCommand({
    prisma: deps.prisma,
    seasonsService: deps.seasonsService,
  });

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
    let academicIdentityMutation: UpdateCurrentUserAcademicIdentityMutationResult = {
      attempted: false,
      changed: false,
      noOpReason: null,
    };

    if (!input.displayIdentity && !input.academicIdentity) {
      return buildUpdateCurrentUserResponse(
        await deps.currentUserViewService.buildCurrentUserResponse(user, now),
        displayIdentityMutation,
        academicIdentityMutation,
      );
    }

    const parsedNickname = input.displayIdentity
      ? displayIdentityCommand.parseDisplayIdentityNickname(input.displayIdentity.nickname)
      : null;
    const parsedAcademicIdentity = input.academicIdentity
      ? academicIdentityCommand.parseAcademicIdentity(input.academicIdentity)
      : null;

    const transactionResult = await deps.prisma.runSerializableTransaction(async (tx) => {
      const txUser = await getUserWithDisplayIdentity(authUser.id, tx);
      if (txUser.deletedAt) {
        throw usersErrors.accountAlreadyDeleted();
      }

      let txDisplayIdentityMutation: UpdateCurrentUserDisplayIdentityMutationResult = {
        attempted: false,
        changed: false,
        noOpReason: null,
      };
      let txAcademicIdentityMutation: UpdateCurrentUserAcademicIdentityMutationResult = {
        attempted: false,
        changed: false,
        noOpReason: null,
      };

      if (parsedNickname) {
        txDisplayIdentityMutation = await displayIdentityCommand.applySelfServiceNicknameChange(
          txUser,
          parsedNickname,
          now,
          tx,
        );
      }

      if (parsedAcademicIdentity) {
        txAcademicIdentityMutation = await academicIdentityCommand.applyAcademicIdentityChange(
          txUser,
          parsedAcademicIdentity,
          now,
          tx,
        );
      }

      return {
        displayIdentity: txDisplayIdentityMutation,
        academicIdentity: txAcademicIdentityMutation,
      };
    });
    displayIdentityMutation = transactionResult.displayIdentity;
    academicIdentityMutation = transactionResult.academicIdentity;

    return buildUpdateCurrentUserResponse(
      await deps.currentUserViewService.buildCurrentUserResponse(
        await getUserWithDisplayIdentity(authUser.id),
        now,
      ),
      displayIdentityMutation,
      academicIdentityMutation,
    );
  }

  async function overrideDisplayIdentityNicknameForPolicyEnforcement(
    input: DisplayIdentityNicknameOverrideInput,
  ): Promise<DisplayIdentityNicknameOverrideResult> {
    return displayIdentityCommand.overrideDisplayIdentityNicknameForPolicyEnforcement(input);
  }

  return {
    updateCurrentUser,
    overrideDisplayIdentityNicknameForPolicyEnforcement,
  };
}

function buildUpdateCurrentUserResponse(
  currentUser: CurrentUserResponse,
  displayIdentity: UpdateCurrentUserDisplayIdentityMutationResult,
  academicIdentity: UpdateCurrentUserAcademicIdentityMutationResult = {
    attempted: false,
    changed: false,
    noOpReason: null,
  },
): UpdateCurrentUserResponse {
  return {
    currentUser,
    mutation: {
      displayIdentity,
      academicIdentity,
    },
  };
}

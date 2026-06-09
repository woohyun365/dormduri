import type {
  CurrentUserResponse,
  UpdateCurrentUserAcademicIdentityRequest,
  UpdateCurrentUserAcademicIdentityMutationResult,
  UpdateCurrentUserDisplayIdentityMutationResult,
  UpdateCurrentUserResponse,
} from '@repo/shared/user';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import { ModerationService } from '../../moderation/moderation.service.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import type { SeasonContextPort } from '../../seasons/ports/season-context.port.js';
import { CurrentUserViewService } from '../current-user/current-user-view.service.js';
import { usersErrors } from '../errors/users.errors.js';
import { createUpdateAcademicIdentityCommand } from '../identity/academic/update-academic-identity.command.js';
import { createUpdateDisplayIdentityCommand } from '../identity/display/update-display-identity.command.js';
import { getUserWithDisplayIdentity } from './user-display-identity.reader.js';

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

export function createUserUpdateOwner(deps: UserUpdateOwnerDeps) {
  const displayIdentityCommand = createUpdateDisplayIdentityCommand({
    prisma: deps.prisma,
    seasonsService: deps.seasonsService,
    moderationService: deps.moderationService,
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
    const user = await getUserWithDisplayIdentity(deps.prisma, authUser.id);
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
      const txUser = await getUserWithDisplayIdentity(tx, authUser.id);
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
        await getUserWithDisplayIdentity(deps.prisma, authUser.id),
        now,
      ),
      displayIdentityMutation,
      academicIdentityMutation,
    );
  }

  return {
    updateCurrentUser,
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

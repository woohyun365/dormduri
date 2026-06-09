import type {
  CurrentUserResponse,
  UpdateCurrentUserAcademicIdentityRequest,
  UpdateCurrentUserAcademicIdentityMutationResult,
  UpdateCurrentUserDisplayIdentityMutationResult,
  UpdateCurrentUserResponse,
} from '@repo/shared/user-contract';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuthenticatedUserContext } from '../auth/application/auth-actor-context.types.js';
import { ModerationService } from '../moderation/moderation.service.js';
import { PrismaService } from '../platform/database/prisma.service.js';
import {
  buildUserWithDisplayIdentitySelect,
  mapUserWithDisplayIdentityProjection,
  type UserAcademicIdentityRecord,
  type UserWithDisplayIdentityRecord,
} from './current-user/current-user.select.js';
import { CurrentUserViewService } from './current-user/current-user-view.service.js';
import { usersErrors } from './users.errors.js';
import type { SeasonContextPort } from '../seasons/ports/season-context.port.js';
import { resolveNicknameChangePolicy } from './identity/display/display-identity-edit.policy.js';
import {
  createUpdateDisplayIdentityCommand,
  type DisplayIdentityNicknameOverrideInput,
  type DisplayIdentityNicknameOverrideResult,
} from './identity/display/update-display-identity.command.js';
import { consumeAcademicCollegeChangeAllowanceTx } from './academic-identity-correction-allowance.owner.js';

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
type AcademicIdentityClient =
  | Pick<
      PrismaService,
      'userAcademicIdentity' | 'seasonParticipantProfileHistory' | 'seasonParticipant'
    >
  | Pick<
      Prisma.TransactionClient,
      'userAcademicIdentity' | 'seasonParticipantProfileHistory' | 'seasonParticipant'
    >;

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
      ? parseAcademicIdentity(input.academicIdentity)
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
        txAcademicIdentityMutation = await applyAcademicIdentityChange(
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

  async function applyAcademicIdentityChange(
    txUser: UserWithDisplayIdentityRecord,
    parsedAcademicIdentity: UpdateCurrentUserAcademicIdentityRequest,
    now: Date,
    tx: Prisma.TransactionClient,
  ): Promise<UpdateCurrentUserAcademicIdentityMutationResult> {
    const academicIdentity = assertAcademicIdentity(txUser.academicIdentity);

    if (isSameAcademicIdentity(academicIdentity, parsedAcademicIdentity)) {
      return {
        attempted: true,
        changed: false,
        noOpReason: 'SAME_ACADEMIC_IDENTITY',
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
      throw usersErrors.academicIdentityLockedByRegistration();
    }

    const collegeChanged = academicIdentity.collegeCode !== parsedAcademicIdentity.collegeCode;
    const birthYearChanged = academicIdentity.birthYear !== parsedAcademicIdentity.birthYear;

    if (birthYearChanged) {
      await assertBirthYearEditableBeforeRegistration(txUser.id, tx);
    }
    if (collegeChanged) {
      await consumeAcademicCollegeChangeAllowanceTx(tx, {
        userId: txUser.id,
        campus: txUser.campus,
        now,
      });
    }

    await updateAcademicIdentity(txUser.id, parsedAcademicIdentity, tx);
    await tx.userAcademicIdentityChangeEvent.create({
      data: {
        userId: txUser.id,
        retainedIdentityId: null,
        source: 'USER_SELF',
        reason: birthYearChanged ? 'USER_CORRECTION' : 'ACADEMIC_CYCLE_ALLOWANCE',
        actorType: 'USER',
        actorId: txUser.id,
        previousCollegeCode: academicIdentity.collegeCode,
        nextCollegeCode: parsedAcademicIdentity.collegeCode,
        previousBirthYear: academicIdentity.birthYear,
        nextBirthYear: parsedAcademicIdentity.birthYear,
        seasonId: null,
        participantId: null,
        reportId: null,
        moderationCaseId: null,
        sanctionId: null,
        approvalReference: null,
        changedAt: now,
      },
      select: { id: true },
    });

    return {
      attempted: true,
      changed: true,
      noOpReason: null,
    };
  }

  async function overrideDisplayIdentityNicknameForPolicyEnforcement(
    input: DisplayIdentityNicknameOverrideInput,
  ): Promise<DisplayIdentityNicknameOverrideResult> {
    return displayIdentityCommand.overrideDisplayIdentityNicknameForPolicyEnforcement(input);
  }

  function parseAcademicIdentity(input: UpdateCurrentUserAcademicIdentityRequest) {
    return {
      collegeCode: input.collegeCode,
      birthYear: input.birthYear,
    };
  }

  async function assertBirthYearEditableBeforeRegistration(
    userId: string,
    client: AcademicIdentityClient = deps.prisma,
  ) {
    const participantRows = await client.seasonParticipant.findMany({
      where: { userId },
      select: { id: true },
    });
    if (participantRows.length === 0) {
      return;
    }

    const registrationSnapshot = await client.seasonParticipantProfileHistory.findFirst({
      where: {
        source: 'SEASON_REGISTRATION',
        participantId: { in: participantRows.map((participant) => participant.id) },
      },
      select: { id: true },
    });

    if (registrationSnapshot) {
      throw usersErrors.academicBirthYearLockedAfterRegistration();
    }
  }

  async function updateAcademicIdentity(
    userId: string,
    parsedAcademicIdentity: UpdateCurrentUserAcademicIdentityRequest,
    client: AcademicIdentityClient = deps.prisma,
  ) {
    await client.userAcademicIdentity.upsert({
      where: { userId },
      create: {
        userId,
        collegeCode: parsedAcademicIdentity.collegeCode,
        birthYear: parsedAcademicIdentity.birthYear,
      },
      update: {
        collegeCode: parsedAcademicIdentity.collegeCode,
        birthYear: parsedAcademicIdentity.birthYear,
      },
    });
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

function assertAcademicIdentity(
  academicIdentity: UserWithDisplayIdentityRecord['academicIdentity'],
): UserAcademicIdentityRecord {
  if (!academicIdentity) {
    throw new Error('[UsersService] user academic identity row is required');
  }
  return academicIdentity;
}

function isSameAcademicIdentity(
  academicIdentity: UserAcademicIdentityRecord,
  parsedAcademicIdentity: UpdateCurrentUserAcademicIdentityRequest,
) {
  return (
    academicIdentity.collegeCode === parsedAcademicIdentity.collegeCode &&
    academicIdentity.birthYear === parsedAcademicIdentity.birthYear
  );
}

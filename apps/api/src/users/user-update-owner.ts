import type {
  CurrentUserResponse,
  UpdateCurrentUserAcademicIdentityRequest,
  UpdateCurrentUserAcademicIdentityMutationResult,
  UpdateCurrentUserDisplayIdentityMutationResult,
  UpdateCurrentUserResponse,
} from '@repo/shared/user-contract';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuthenticatedUserContext } from '../auth/application/auth-actor-context.types.js';
import {
  normalizeNickname,
  validateNicknameStructure as validateNicknameFormat,
} from '@repo/shared/auth-policy';
import { ModerationService } from '../common/moderation/moderation.service.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { hasNicknameCooldown } from './nickname-policy.js';
import {
  buildUserWithDisplayIdentitySelect,
  mapUserWithDisplayIdentityProjection,
  type UserAcademicIdentityRecord,
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
import {
  recordDisplayIdentityNicknameChangeAuditTx,
  type DisplayIdentityNicknameAuditReference,
} from './display-identity-nickname-audit.owner.js';
import { consumeAcademicCollegeChangeAllowanceTx } from './academic-identity-correction-allowance.owner.js';

export interface UpdateCurrentUserInput {
  displayIdentity?: {
    nickname: string;
  };
  academicIdentity?: UpdateCurrentUserAcademicIdentityRequest;
}

export type DisplayIdentityNicknameOverrideReason =
  | 'REPORT_REVIEW'
  | 'ENFORCEMENT_ACTION'
  | 'SAFETY_INCIDENT'
  | 'RESERVED_OR_BLOCKED_TERM'
  | 'ADMIN_MANUAL';

export interface DisplayIdentityNicknameOverrideInput extends DisplayIdentityNicknameAuditReference {
  userId: string;
  nickname: string;
  actorId: string;
  actorType?: 'ADMIN' | 'SYSTEM';
  reason: DisplayIdentityNicknameOverrideReason;
}

export interface DisplayIdentityNicknameOverrideResult {
  userId: string;
  nickname: string;
  nicknameNormalized: string;
  nicknameChangedAt: string;
  override: {
    actorId: string;
    actorType: 'ADMIN' | 'SYSTEM';
    reason: DisplayIdentityNicknameOverrideReason;
    appliedAt: string;
    auditEventId: string;
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
      ? parseDisplayIdentityNickname(input.displayIdentity.nickname)
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
        txDisplayIdentityMutation = await applyDisplayIdentityNicknameChange(
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

  async function applyDisplayIdentityNicknameChange(
    txUser: UserWithDisplayIdentityRecord,
    parsedNickname: { nickname: string; nicknameNormalized: string },
    now: Date,
    tx: Prisma.TransactionClient,
  ): Promise<UpdateCurrentUserDisplayIdentityMutationResult> {
    const displayIdentity = assertDisplayIdentity(txUser.displayIdentity);

    if (isSameNickname(displayIdentity, parsedNickname)) {
      return {
        attempted: true,
        changed: false,
        noOpReason: 'SAME_NICKNAME',
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
    await assertNicknameAvailableForUser(parsedNickname, txUser.id, tx);
    await updateDisplayIdentityNickname(txUser.id, displayIdentity, parsedNickname, now, tx);
    await recordDisplayIdentityNicknameChangeAuditTx(tx, {
      userId: txUser.id,
      source: 'USER_SELF',
      reason: 'USER_REQUEST',
      actorType: 'USER',
      actorId: txUser.id,
      previousNickname: displayIdentity.nickname,
      previousNicknameNormalized: displayIdentity.nicknameNormalized,
      nextNickname: parsedNickname.nickname,
      nextNicknameNormalized: parsedNickname.nicknameNormalized,
      changedAt: now,
    });

    return {
      attempted: true,
      changed: true,
      noOpReason: null,
    };
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
    const now = await deps.prisma.getDatabaseNow();
    const parsedNickname = parseDisplayIdentityNickname(input.nickname);
    await assertNicknamePolicyAccepted(parsedNickname.nickname);
    let auditEventId: string | null = null;

    await deps.prisma.runSerializableTransaction(async (tx) => {
      const txUser = await getUserWithDisplayIdentity(input.userId, tx);
      const displayIdentity = assertDisplayIdentity(txUser.displayIdentity);
      await assertNicknameAvailableForUser(parsedNickname, input.userId, tx);

      const nicknamePolicy = await resolveNicknameChangePolicy(
        {
          prisma: deps.prisma,
          seasonsService: deps.seasonsService,
        },
        txUser,
        now,
        tx,
      );

      if (!isSameNickname(displayIdentity, parsedNickname)) {
        await updateDisplayIdentityNickname(input.userId, displayIdentity, parsedNickname, now, tx);
      }

      let seasonProfileSnapshotUpdated = false;
      if (nicknamePolicy.currentRegisteredParticipant) {
        const snapshotUpdate = await tx.seasonParticipantProfile.updateMany({
          where: { participantId: nicknamePolicy.currentRegisteredParticipant.id },
          data: {
            nicknameSnapshot: parsedNickname.nickname,
            nicknameNormalizedSnapshot: parsedNickname.nicknameNormalized,
          },
        });
        seasonProfileSnapshotUpdated = snapshotUpdate.count > 0;
      }

      const auditEvent = await recordDisplayIdentityNicknameChangeAuditTx(tx, {
        userId: input.userId,
        source: 'POLICY_ENFORCEMENT',
        reason: input.reason,
        actorType: input.actorType ?? 'ADMIN',
        actorId: input.actorId,
        previousNickname: displayIdentity.nickname,
        previousNicknameNormalized: displayIdentity.nicknameNormalized,
        nextNickname: parsedNickname.nickname,
        nextNicknameNormalized: parsedNickname.nicknameNormalized,
        seasonId: nicknamePolicy.currentRegisteredParticipant?.seasonId ?? null,
        participantId: nicknamePolicy.currentRegisteredParticipant?.id ?? null,
        seasonProfileSnapshotUpdated,
        reportId: input.reportId,
        moderationCaseId: input.moderationCaseId,
        sanctionId: input.sanctionId,
        approvalReference: input.approvalReference,
        metadata: input.metadata,
        changedAt: now,
      });
      auditEventId = auditEvent.id;
    });

    return {
      userId: input.userId,
      nickname: parsedNickname.nickname,
      nicknameNormalized: parsedNickname.nicknameNormalized,
      nicknameChangedAt: now.toISOString(),
      override: {
        actorId: input.actorId,
        actorType: input.actorType ?? 'ADMIN',
        reason: input.reason,
        appliedAt: now.toISOString(),
        auditEventId: auditEventId ?? '',
      },
    };
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

  function parseAcademicIdentity(input: UpdateCurrentUserAcademicIdentityRequest) {
    return {
      collegeCode: input.collegeCode,
      birthYear: input.birthYear,
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

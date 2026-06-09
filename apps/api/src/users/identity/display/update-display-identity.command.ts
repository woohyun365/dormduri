import type { UpdateCurrentUserDisplayIdentityMutationResult } from '@repo/shared/user';
import {
  normalizeNickname,
  validateNicknameStructure as validateNicknameFormat,
} from '@repo/shared/auth-policy';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { ModerationService } from '../../../moderation/moderation.service.js';
import type { PrismaService } from '../../../platform/database/prisma.service.js';
import type { SeasonContextPort } from '../../../seasons/ports/season-context.port.js';
import type { UserWithDisplayIdentityRecord } from '../../current-user/current-user.select.js';
import { usersErrors } from '../../users.errors.js';
import { hasNicknameCooldown } from './nickname-cooldown.policy.js';
import { resolveNicknameChangePolicy } from './display-identity-edit.policy.js';
import {
  assertDisplayIdentity,
  assertNicknameAvailableForUser,
  isSameNickname,
  type ParsedDisplayIdentityNickname,
  updateDisplayIdentityNickname,
} from './display-identity.repository.js';
import {
  recordDisplayIdentityNicknameChangeAuditTx,
  type DisplayIdentityNicknameAuditReference,
} from '../audit/display-identity-nickname-audit.repository.js';

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

export interface UpdateDisplayIdentityCommandDeps {
  prisma: PrismaService;
  seasonsService: SeasonContextPort;
  moderationService: ModerationService;
  getUserWithDisplayIdentity: (
    userId: string,
    client?: Pick<PrismaService, 'user'> | Pick<Prisma.TransactionClient, 'user'>,
  ) => Promise<UserWithDisplayIdentityRecord>;
}

export function createUpdateDisplayIdentityCommand(deps: UpdateDisplayIdentityCommandDeps) {
  function parseDisplayIdentityNickname(nickname: string): ParsedDisplayIdentityNickname {
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

  async function applySelfServiceNicknameChange(
    txUser: UserWithDisplayIdentityRecord,
    parsedNickname: ParsedDisplayIdentityNickname,
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
    await assertNicknameAvailableForUser(tx, parsedNickname, txUser.id);
    await updateDisplayIdentityNickname(tx, {
      userId: txUser.id,
      displayIdentity,
      parsedNickname,
      now,
    });
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

  async function overrideDisplayIdentityNicknameForPolicyEnforcement(
    input: DisplayIdentityNicknameOverrideInput,
  ): Promise<DisplayIdentityNicknameOverrideResult> {
    const now = await deps.prisma.getDatabaseNow();
    const parsedNickname = parseDisplayIdentityNickname(input.nickname);
    await assertNicknamePolicyAccepted(parsedNickname.nickname);
    let auditEventId: string | null = null;

    await deps.prisma.runSerializableTransaction(async (tx) => {
      const txUser = await deps.getUserWithDisplayIdentity(input.userId, tx);
      const displayIdentity = assertDisplayIdentity(txUser.displayIdentity);
      await assertNicknameAvailableForUser(tx, parsedNickname, input.userId);

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
        await updateDisplayIdentityNickname(tx, {
          userId: input.userId,
          displayIdentity,
          parsedNickname,
          now,
        });
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

  async function assertNicknamePolicyAccepted(nickname: string) {
    const nicknamePolicyError = await deps.moderationService.validateNicknamePolicy(nickname);
    if (nicknamePolicyError) {
      throw usersErrors.nicknameModerationRejected(nicknamePolicyError);
    }
  }

  return {
    parseDisplayIdentityNickname,
    applySelfServiceNicknameChange,
    overrideDisplayIdentityNicknameForPolicyEnforcement,
  };
}

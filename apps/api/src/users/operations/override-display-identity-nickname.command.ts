import { parseDisplayIdentityNickname as parseSharedDisplayIdentityNickname } from '@repo/shared/user/identity/display';
import type { Prisma } from '../../generated/prisma/client.js';
import type { ModerationService } from '../../moderation/moderation.service.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import type { SeasonContextPort } from '../../seasons/ports/season-context.port.js';
import { getUserWithDisplayIdentity } from '../application/user-display-identity.reader.js';
import { usersErrors } from '../errors/users.errors.js';
import {
  recordDisplayIdentityNicknameChangeAuditTx,
  type DisplayIdentityNicknameAuditReference,
} from '../identity/audit/display-identity-nickname-audit.repository.js';
import { resolveNicknameChangePolicy } from '../identity/display/display-identity-edit.policy.js';
import {
  assertDisplayIdentity,
  assertNicknameAvailableForUser,
  isSameNickname,
  type ParsedDisplayIdentityNickname,
  updateDisplayIdentityNickname,
} from '../identity/display/display-identity.repository.js';

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

export interface OverrideDisplayIdentityNicknameCommandDeps {
  prisma: PrismaService;
  seasonsService: SeasonContextPort;
  moderationService: ModerationService;
}

export function createOverrideDisplayIdentityNicknameCommand(
  deps: OverrideDisplayIdentityNicknameCommandDeps,
) {
  async function overrideDisplayIdentityNicknameForPolicyEnforcement(
    input: DisplayIdentityNicknameOverrideInput,
  ): Promise<DisplayIdentityNicknameOverrideResult> {
    const parsedNickname = parseDisplayIdentityNickname(input.nickname);
    const now = await deps.prisma.getDatabaseNow();
    await assertNicknamePolicyAccepted(parsedNickname.value);
    let auditEventId: string | null = null;

    await deps.prisma.runSerializableTransaction(async (tx) => {
      const txUser = await getUserWithDisplayIdentity(tx, input.userId);
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

      const seasonProfileSnapshotUpdated = await updateRegisteredSeasonProfileSnapshot(
        tx,
        nicknamePolicy.currentRegisteredParticipant?.id ?? null,
        parsedNickname,
      );

      const auditEvent = await recordDisplayIdentityNicknameChangeAuditTx(tx, {
        userId: input.userId,
        source: 'POLICY_ENFORCEMENT',
        reason: input.reason,
        actorType: input.actorType ?? 'ADMIN',
        actorId: input.actorId,
        previousNickname: displayIdentity.nickname,
        previousNicknameNormalized: displayIdentity.nicknameNormalized,
        nextNickname: parsedNickname.value,
        nextNicknameNormalized: parsedNickname.normalized,
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
      nickname: parsedNickname.value,
      nicknameNormalized: parsedNickname.normalized,
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
    overrideDisplayIdentityNicknameForPolicyEnforcement,
  };
}

function parseDisplayIdentityNickname(nickname: string): ParsedDisplayIdentityNickname {
  const parsedNickname = parseSharedDisplayIdentityNickname(nickname);
  if (!parsedNickname.ok) {
    throw usersErrors.invalidNickname(parsedNickname.message);
  }

  return parsedNickname;
}

async function updateRegisteredSeasonProfileSnapshot(
  tx: Prisma.TransactionClient,
  participantId: string | null,
  parsedNickname: ParsedDisplayIdentityNickname,
) {
  if (!participantId) {
    return false;
  }

  const snapshotUpdate = await tx.seasonParticipantProfile.updateMany({
    where: { participantId },
    data: {
      nicknameSnapshot: parsedNickname.value,
      nicknameNormalizedSnapshot: parsedNickname.normalized,
    },
  });

  return snapshotUpdate.count > 0;
}

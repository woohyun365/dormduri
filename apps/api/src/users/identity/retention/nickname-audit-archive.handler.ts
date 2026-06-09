import { DEIDENTIFIED_USER_DISPLAY_NAME } from '../../../privacy/deidentification/deidentified-display.policy.js';
import type { PrismaService } from '../../../platform/database/prisma.service.js';
import {
  buildJobMetadata,
  buildVaultAad,
  toVaultJson,
} from '../../../retention/archive-jobs/archive-job.payload.js';
import { toArchiveStorageError } from '../../../retention/archive-jobs/archive-job-transition.policy.js';
import type {
  ArchiveJobWorkItem,
  ArchiveStorageResult,
} from '../../../retention/archive-jobs/archive-job.types.js';
import { loadRetainedIdentityForCaseTx } from '../../../retention/retained-identities/retained-identity-hold.query.js';
import { ensureRetentionCaseTx } from '../../../retention/vault/retention-case.repository.js';
import {
  retainVaultPayloadTx,
  type RetainedVaultOwnerOptions,
} from '../../../retention/vault/retained-vault.service.js';

export async function archiveNicknameAuditJob(
  prisma: PrismaService,
  job: ArchiveJobWorkItem,
  now: Date,
  retainedVaultOptions: RetainedVaultOwnerOptions,
): Promise<ArchiveStorageResult> {
  if (!job.userId || !job.retainedIdentityId) {
    return { ok: false, errorCode: 'NICKNAME_AUDIT_CONTEXT_MISSING' };
  }

  const userId = job.userId;
  const retainedIdentityId = job.retainedIdentityId;

  try {
    await prisma.runSerializableTransaction(async (tx) => {
      const retainedIdentity = await loadRetainedIdentityForCaseTx(tx, retainedIdentityId);
      const retentionCase = await ensureRetentionCaseTx(tx, {
        reason: retainedIdentity.retentionCaseReason,
        triggerUserId: userId,
        triggerRetainedIdentityId: retainedIdentityId,
        sourceTable: 'UserDisplayIdentityNicknameChangeEvent',
        sourceId: userId,
        retentionHoldUntil: retainedIdentity.retentionHoldUntil,
        legalHoldReason: retainedIdentity.legalHoldReason,
        metadata: buildJobMetadata(job),
      });

      await tx.userDisplayIdentityNicknameChangeEvent.updateMany({
        where: { userId, retainedIdentityId: null },
        data: { retainedIdentityId },
      });

      const events = await tx.userDisplayIdentityNicknameChangeEvent.findMany({
        where: { userId, redactedAt: null },
        orderBy: [{ changedAt: 'asc' }, { id: 'asc' }],
      });

      for (const event of events) {
        const retained = await retainVaultPayloadTx(
          tx,
          {
            target: 'NICKNAME_AUDIT_EVENT',
            sourceTable: 'UserDisplayIdentityNicknameChangeEvent',
            sourceId: event.id,
            archiveJobId: job.id,
            subjectUserId: event.userId,
            subjectRetainedIdentityId: retainedIdentityId,
            subjectRole: 'USER',
            keyPurpose: 'NICKNAME_AUDIT',
            payloadSchemaVersion: 1,
            plaintext: toVaultJson({ schemaVersion: 1, event }),
            aad: buildVaultAad('NICKNAME_AUDIT_EVENT', event.id),
            retainedAt: now,
            metadata: buildJobMetadata(job),
            retentionCaseId: retentionCase.id,
            holdReason: retainedIdentity.retentionCaseReason,
            holdUntil: retainedIdentity.retentionHoldUntil,
          },
          retainedVaultOptions,
        );

        await tx.userDisplayIdentityNicknameChangeEvent.update({
          where: { id: event.id },
          data: {
            retainedIdentityId,
            retainedVaultObjectId: retained.id,
            redactedAt: now,
            redactionReason: 'ACCOUNT_DELETION',
            previousNickname: DEIDENTIFIED_USER_DISPLAY_NAME,
            previousNicknameNormalized: `redacted-${event.id}`,
            nextNickname: DEIDENTIFIED_USER_DISPLAY_NAME,
            nextNicknameNormalized: `redacted-${event.id}`,
            actorId: event.actorType === 'USER' && event.actorId === userId ? null : event.actorId,
          },
        });
      }
    });
    return { ok: true };
  } catch (error) {
    return toArchiveStorageError(error, 'NICKNAME_AUDIT_ARCHIVE_ERROR');
  }
}

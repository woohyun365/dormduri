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

export async function archiveAcademicIdentityAuditJob(
  prisma: PrismaService,
  job: ArchiveJobWorkItem,
  now: Date,
  retainedVaultOptions: RetainedVaultOwnerOptions,
): Promise<ArchiveStorageResult> {
  if (!job.userId || !job.retainedIdentityId) {
    return { ok: false, errorCode: 'ACADEMIC_IDENTITY_AUDIT_CONTEXT_MISSING' };
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
        sourceTable: 'UserAcademicIdentityChangeEvent',
        sourceId: userId,
        retentionHoldUntil: retainedIdentity.retentionHoldUntil,
        legalHoldReason: retainedIdentity.legalHoldReason,
        metadata: buildJobMetadata(job),
      });

      await tx.userAcademicIdentityChangeEvent.updateMany({
        where: { userId, retainedIdentityId: null },
        data: { retainedIdentityId },
      });

      const events = await tx.userAcademicIdentityChangeEvent.findMany({
        where: { userId, redactedAt: null },
        orderBy: [{ changedAt: 'asc' }, { id: 'asc' }],
      });

      for (const event of events) {
        const retained = await retainVaultPayloadTx(
          tx,
          {
            target: 'ACADEMIC_IDENTITY_AUDIT_EVENT',
            sourceTable: 'UserAcademicIdentityChangeEvent',
            sourceId: event.id,
            archiveJobId: job.id,
            subjectUserId: event.userId,
            subjectRetainedIdentityId: retainedIdentityId,
            subjectRole: 'USER',
            keyPurpose: 'ACADEMIC_IDENTITY_AUDIT',
            payloadSchemaVersion: 1,
            plaintext: toVaultJson({ schemaVersion: 1, event }),
            aad: buildVaultAad('ACADEMIC_IDENTITY_AUDIT_EVENT', event.id),
            retainedAt: now,
            metadata: buildJobMetadata(job),
            retentionCaseId: retentionCase.id,
            holdReason: retainedIdentity.retentionCaseReason,
            holdUntil: retainedIdentity.retentionHoldUntil,
          },
          retainedVaultOptions,
        );

        await tx.userAcademicIdentityChangeEvent.update({
          where: { id: event.id },
          data: {
            retainedIdentityId,
            retainedVaultObjectId: retained.id,
            redactedAt: now,
            redactionReason: 'ACCOUNT_DELETION',
            previousCollegeCode: 'REDACTED',
            nextCollegeCode: 'REDACTED',
            previousBirthYear: 0,
            nextBirthYear: 0,
            actorId: event.actorType === 'USER' && event.actorId === userId ? null : event.actorId,
          },
        });
      }
    });
    return { ok: true };
  } catch (error) {
    return toArchiveStorageError(error, 'ACADEMIC_IDENTITY_AUDIT_ARCHIVE_ERROR');
  }
}

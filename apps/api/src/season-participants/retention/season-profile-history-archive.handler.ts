import { DEIDENTIFIED_USER_DISPLAY_NAME } from '../../privacy/deidentification/deidentified-display.policy.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import {
  buildJobMetadata,
  buildVaultAad,
  toVaultJson,
} from '../../retention/archive-jobs/archive-job.payload.js';
import { toArchiveStorageError } from '../../retention/archive-jobs/archive-job-transition.policy.js';
import type {
  ArchiveJobWorkItem,
  ArchiveStorageResult,
} from '../../retention/archive-jobs/archive-job.types.js';
import { loadRetainedIdentityForCaseTx } from '../../retention/retained-identities/retained-identity-hold.query.js';
import { ensureRetentionCaseTx } from '../../retention/vault/retention-case.repository.js';
import {
  retainVaultPayloadTx,
  type RetainedVaultOwnerOptions,
} from '../../retention/vault/retained-vault.service.js';

export async function archiveSeasonProfileHistoryJob(
  prisma: PrismaService,
  job: ArchiveJobWorkItem,
  now: Date,
  retainedVaultOptions: RetainedVaultOwnerOptions,
): Promise<ArchiveStorageResult> {
  if (!job.participantId || !job.retainedIdentityId) {
    return { ok: false, errorCode: 'SEASON_PROFILE_HISTORY_CONTEXT_MISSING' };
  }

  const userId = job.userId;
  const participantId = job.participantId;
  const retainedIdentityId = job.retainedIdentityId;

  try {
    await prisma.runSerializableTransaction(async (tx) => {
      const retainedIdentity = await loadRetainedIdentityForCaseTx(tx, retainedIdentityId);
      const retentionCase = await ensureRetentionCaseTx(tx, {
        reason: retainedIdentity.retentionCaseReason,
        triggerUserId: userId,
        triggerRetainedIdentityId: retainedIdentityId,
        sourceTable: 'SeasonParticipantProfileHistory',
        sourceId: participantId,
        retentionHoldUntil: retainedIdentity.retentionHoldUntil,
        legalHoldReason: retainedIdentity.legalHoldReason,
        metadata: buildJobMetadata(job),
      });
      const histories = await tx.seasonParticipantProfileHistory.findMany({
        where: { participantId, redactedAt: null },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });

      for (const history of histories) {
        const retained = await retainVaultPayloadTx(
          tx,
          {
            target: 'SEASON_PROFILE_HISTORY',
            sourceTable: 'SeasonParticipantProfileHistory',
            sourceId: history.id,
            archiveJobId: job.id,
            subjectUserId: userId,
            subjectRetainedIdentityId: retainedIdentityId,
            subjectParticipantId: history.participantId,
            subjectRole: 'PARTICIPANT',
            keyPurpose: 'SEASON_PROFILE_HISTORY',
            payloadSchemaVersion: 1,
            plaintext: toVaultJson({ schemaVersion: 1, history }),
            aad: buildVaultAad('SEASON_PROFILE_HISTORY', history.id),
            retainedAt: now,
            metadata: buildJobMetadata(job),
            retentionCaseId: retentionCase.id,
            holdReason: retainedIdentity.retentionCaseReason,
            holdUntil: retainedIdentity.retentionHoldUntil,
          },
          retainedVaultOptions,
        );
        await tx.seasonParticipantProfileHistory.update({
          where: { id: history.id },
          data: {
            retainedIdentityId,
            retainedVaultObjectId: retained.id,
            redactedAt: now,
            redactionReason: 'ACCOUNT_DELETION',
            nicknameSnapshot: DEIDENTIFIED_USER_DISPLAY_NAME,
            nicknameNormalizedSnapshot: `redacted-${history.id}`,
            bedtime: null,
            wakeTime: null,
            sleepHabit: null,
            sleepEnvironment: null,
            screenUsage: null,
            noiseSensitivity: null,
            smokingBehavior: null,
            indoorEating: null,
            phoneBehavior: null,
            earphoneUsage: null,
            cleanLevel: null,
            drinkingFrequency: null,
            relationshipStyle: null,
            temperatureSensitivity: null,
            smokingTolerance: null,
            phoneTolerance: null,
            earphoneExpectation: null,
            sleepEnvPreference: null,
            screenTolerance: null,
            indoorEatingTolerance: null,
            cleanExpectation: null,
            drinkingTolerance: null,
            intro: '',
            collegeCode: null,
            grade: null,
            mbti: null,
            birthYear: null,
          },
        });
      }
    });
    return { ok: true };
  } catch (error) {
    return toArchiveStorageError(error, 'SEASON_PROFILE_HISTORY_ARCHIVE_ERROR');
  }
}

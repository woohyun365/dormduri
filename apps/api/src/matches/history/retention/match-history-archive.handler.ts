import { Prisma } from '../../../generated/prisma/client.js';
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

export async function archiveMatchHistoryJob(
  prisma: PrismaService,
  job: ArchiveJobWorkItem,
  now: Date,
  retainedVaultOptions: RetainedVaultOwnerOptions,
): Promise<ArchiveStorageResult> {
  if (!job.matchHistoryEntryId || !job.retainedIdentityId || !job.userId) {
    return { ok: false, errorCode: 'MATCH_HISTORY_CONTEXT_MISSING' };
  }

  const userId = job.userId;
  const retainedIdentityId = job.retainedIdentityId;

  try {
    await prisma.runSerializableTransaction(async (tx) => {
      const retainedIdentity = await loadRetainedIdentityForCaseTx(tx, retainedIdentityId);
      const entry = await tx.seasonMatchHistoryEntry.findUnique({
        where: { id: job.matchHistoryEntryId! },
        include: {
          viewerParticipant: { select: { id: true, userId: true } },
          counterpartParticipant: { select: { id: true, userId: true } },
        },
      });
      if (!entry) {
        throw new Error('MATCH_HISTORY_ENTRY_NOT_FOUND');
      }

      const retentionCase = await ensureRetentionCaseTx(tx, {
        reason: retainedIdentity.retentionCaseReason,
        triggerUserId: userId,
        triggerRetainedIdentityId: retainedIdentityId,
        sourceTable: 'SeasonMatchHistoryEntry',
        sourceId: entry.id,
        retentionHoldUntil: retainedIdentity.retentionHoldUntil,
        legalHoldReason: retainedIdentity.legalHoldReason,
        metadata: buildJobMetadata(job),
      });

      const roles: Array<{
        role: 'VIEWER' | 'COUNTERPART';
        participantId: string;
        userId: string;
      }> = [];
      if (entry.viewerParticipant.userId === userId) {
        roles.push({ role: 'VIEWER', participantId: entry.viewerParticipantId, userId });
      }
      if (entry.counterpartParticipant.userId === userId) {
        roles.push({
          role: 'COUNTERPART',
          participantId: entry.counterpartParticipantId,
          userId,
        });
      }

      for (const role of roles) {
        const retained = await retainVaultPayloadTx(
          tx,
          {
            target: 'MATCH_HISTORY_ENTRY',
            sourceTable: 'SeasonMatchHistoryEntry',
            sourceId: entry.id,
            archiveJobId: job.id,
            subjectUserId: role.userId,
            subjectRetainedIdentityId: retainedIdentityId,
            subjectParticipantId: role.participantId,
            subjectRole: role.role,
            keyPurpose: 'MATCH_HISTORY',
            payloadSchemaVersion: 1,
            plaintext: toVaultJson({ schemaVersion: 1, subjectRole: role.role, entry }),
            aad: buildVaultAad('MATCH_HISTORY_ENTRY', `${entry.id}:${role.role}`),
            retainedAt: now,
            metadata: buildJobMetadata(job),
            retentionCaseId: retentionCase.id,
            holdReason: retainedIdentity.retentionCaseReason,
            holdUntil: retainedIdentity.retentionHoldUntil,
          },
          retainedVaultOptions,
        );
        await tx.seasonMatchHistoryEntryRetentionLink.upsert({
          where: {
            matchHistoryEntryId_retainedIdentityId_subjectRole: {
              matchHistoryEntryId: entry.id,
              retainedIdentityId,
              subjectRole: role.role,
            },
          },
          update: {
            retainedVaultObjectId: retained.id,
            redactedAt: now,
            redactionReason: 'ACCOUNT_DELETION',
          },
          create: {
            matchHistoryEntryId: entry.id,
            participantId: role.participantId,
            userId: role.userId,
            retainedIdentityId,
            subjectRole: role.role,
            retainedVaultObjectId: retained.id,
            redactedAt: now,
            redactionReason: 'ACCOUNT_DELETION',
          },
        });
      }

      const updateData: Prisma.SeasonMatchHistoryEntryUpdateInput = {};
      if (roles.length > 0) {
        Object.assign(updateData, {
          compatibilitySnapshot: Prisma.DbNull,
          compatibilitySchemaVersion: null,
        });
      }
      if (roles.some((role) => role.role === 'VIEWER')) {
        Object.assign(updateData, {
          viewerSmokingToleranceSnapshot: null,
          viewerPhoneToleranceSnapshot: null,
          viewerEarphoneExpectationSnapshot: null,
          viewerSleepEnvPreferenceSnapshot: null,
          viewerScreenToleranceSnapshot: null,
          viewerIndoorEatingToleranceSnapshot: null,
          viewerCleanExpectationSnapshot: null,
          viewerDrinkingToleranceSnapshot: null,
          viewerBedtimeSnapshot: null,
          viewerWakeTimeSnapshot: null,
          viewerRelationshipStyleSnapshot: null,
          viewerTemperatureSensitivitySnapshot: null,
          viewerRedactedAt: now,
          matchScore: null,
        });
      }
      if (roles.some((role) => role.role === 'COUNTERPART')) {
        Object.assign(updateData, {
          counterpartBedtimeSnapshot: null,
          counterpartWakeTimeSnapshot: null,
          counterpartSleepHabitSnapshot: null,
          counterpartSleepEnvironmentSnapshot: null,
          counterpartScreenUsageSnapshot: null,
          counterpartNoiseSensitivitySnapshot: null,
          counterpartSmokingBehaviorSnapshot: null,
          counterpartIndoorEatingSnapshot: null,
          counterpartPhoneBehaviorSnapshot: null,
          counterpartEarphoneUsageSnapshot: null,
          counterpartCleanLevelSnapshot: null,
          counterpartDrinkingFrequencySnapshot: null,
          counterpartRelationshipStyleSnapshot: null,
          counterpartTemperatureSensitivitySnapshot: null,
          counterpartNicknameSnapshot: DEIDENTIFIED_USER_DISPLAY_NAME,
          counterpartRedactedAt: now,
          matchScore: null,
        });
      }

      if (Object.keys(updateData).length > 0) {
        await tx.seasonMatchHistoryEntry.update({
          where: { id: entry.id },
          data: updateData,
        });
      }
    });
    return { ok: true };
  } catch (error) {
    return toArchiveStorageError(error, 'MATCH_HISTORY_ARCHIVE_ERROR');
  }
}

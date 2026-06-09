import type { Prisma } from '../../../generated/prisma/client.js';
import type { LegalHoldReason, RetentionCaseReason } from '../../../generated/prisma/enums.js';
import { DEIDENTIFIED_USER_DISPLAY_NAME } from '../../../privacy/deidentification/deidentified-display.policy.js';
import type { PrismaService } from '../../../platform/database/prisma.service.js';
import { ensureRetentionCaseTx } from '../../vault/retention-case.repository.js';
import {
  retainVaultPayloadTx,
  type RetainedVaultOwnerOptions,
} from '../../vault/retained-vault.service.js';
import type { createConversationRetainedBodyOwner } from '../../conversation-retained-body-owner.js';
import { scheduleChatIdentityLinkReviewJobTx } from '../../review-jobs/schedule-chat-identity-link-review-job.command.js';
import {
  buildJobMetadata,
  buildVaultAad,
  resolveChatIdentityReviewAfter,
  toVaultJson,
} from '../archive-job.payload.js';
import {
  normalizeArchiveErrorCode,
  toArchiveStorageError,
} from '../archive-job-transition.policy.js';
import type {
  ArchiveDeletionJobHandler,
  ArchiveJobWorkItem,
  ArchiveStorageResult,
} from '../archive-job.types.js';

const archiveTargetHandlers = {
  THREAD_RETENTION: ({ prisma, job, now, conversationRetention }) =>
    archiveThreadRetentionJob(prisma, job, now, conversationRetention),
  NICKNAME_AUDIT: ({ prisma, job, now, retainedVaultOptions }) =>
    archiveNicknameAuditJob(prisma, job, now, retainedVaultOptions),
  ACADEMIC_IDENTITY_AUDIT: ({ prisma, job, now, retainedVaultOptions }) =>
    archiveAcademicIdentityAuditJob(prisma, job, now, retainedVaultOptions),
  SEASON_PROFILE_HISTORY: ({ prisma, job, now, retainedVaultOptions }) =>
    archiveSeasonProfileHistoryJob(prisma, job, now, retainedVaultOptions),
  MATCH_HISTORY: ({ prisma, job, now, retainedVaultOptions }) =>
    archiveMatchHistoryJob(prisma, job, now, retainedVaultOptions),
} satisfies Partial<Record<ArchiveJobWorkItem['target'], ArchiveDeletionJobHandler>>;

export async function archiveDeletionJob(
  prisma: PrismaService,
  job: ArchiveJobWorkItem,
  now: Date,
  conversationRetention: ReturnType<typeof createConversationRetainedBodyOwner>,
  retainedVaultOptions: RetainedVaultOwnerOptions = {},
): Promise<ArchiveStorageResult> {
  const handler = archiveTargetHandlers[job.target];
  if (!handler) {
    return { ok: false, errorCode: 'ARCHIVE_HANDLER_MISSING' };
  }

  return handler({ prisma, job, now, conversationRetention, retainedVaultOptions });
}

async function archiveNicknameAuditJob(
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
      const retainedIdentity = await loadRetainedIdentityForCase(tx, retainedIdentityId);
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

async function archiveAcademicIdentityAuditJob(
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
      const retainedIdentity = await loadRetainedIdentityForCase(tx, retainedIdentityId);
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

async function archiveSeasonProfileHistoryJob(
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
      const retainedIdentity = await loadRetainedIdentityForCase(tx, retainedIdentityId);
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

async function archiveMatchHistoryJob(
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
      const retainedIdentity = await loadRetainedIdentityForCase(tx, retainedIdentityId);
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

async function archiveThreadRetentionJob(
  prisma: PrismaService,
  job: ArchiveJobWorkItem,
  now: Date,
  conversationRetention: ReturnType<typeof createConversationRetainedBodyOwner>,
): Promise<ArchiveStorageResult> {
  if (!job.threadId) {
    return { ok: false, errorCode: 'THREAD_RETENTION_THREAD_ID_MISSING' };
  }

  const thread = await prisma.conversationThread.findUnique({
    where: { id: job.threadId },
    select: { id: true, status: true },
  });

  if (!thread) {
    return { ok: false, errorCode: 'THREAD_NOT_FOUND' };
  }

  if (thread.status !== 'ARCHIVED') {
    return { ok: false, waitingCondition: true, errorCode: 'THREAD_NOT_ARCHIVED' };
  }

  try {
    await prisma.runSerializableTransaction((tx) =>
      archiveThreadRetentionJobTx(tx, {
        job,
        threadId: thread.id,
        now,
        conversationRetention,
      }),
    );
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      errorCode:
        error instanceof Error
          ? normalizeArchiveErrorCode(error.message)
          : 'THREAD_RETENTION_ARCHIVE_ERROR',
    };
  }
}

async function archiveThreadRetentionJobTx(
  tx: Prisma.TransactionClient,
  input: {
    job: ArchiveJobWorkItem;
    threadId: string;
    now: Date;
    conversationRetention: ReturnType<typeof createConversationRetainedBodyOwner>;
  },
) {
  const { job, threadId, now, conversationRetention } = input;
  await conversationRetention.retainAndTombstoneThreadMessagesTx(tx, {
    threadId,
    archiveJobId: job.id,
    triggerUserId: job.userId,
    triggerRetainedIdentityId: job.retainedIdentityId,
    now,
    metadata: {
      archiveJobId: job.id,
      archiveJobTarget: job.target,
    },
  });
  await scheduleChatIdentityLinkReviewJobTx(tx, {
    threadId,
    dueAt: resolveChatIdentityReviewAfter(job.payload, now),
    archiveJobId: job.id,
    retainedIdentityId: job.retainedIdentityId,
    userId: job.userId,
  });
}

async function loadRetainedIdentityForCase(
  tx: Prisma.TransactionClient,
  retainedIdentityId: string,
) {
  const retainedIdentity = await tx.retainedIdentity.findUnique({
    where: { id: retainedIdentityId },
    select: {
      holds: {
        where: { releasedAt: null },
        select: {
          holdReason: true,
          holdUntil: true,
          createdAt: true,
          retentionCase: {
            select: {
              legalHoldReason: true,
            },
          },
        },
      },
    },
  });
  if (!retainedIdentity) {
    throw new Error('IDENTITY_ANCHOR_NOT_FOUND');
  }

  const activeHold = selectCanonicalIdentityHold(retainedIdentity.holds);
  if (!activeHold) {
    throw new Error('IDENTITY_ANCHOR_HOLD_NOT_FOUND');
  }

  return {
    retentionCaseReason: activeHold.holdReason,
    retentionHoldUntil: activeHold.holdUntil,
    legalHoldReason: activeHold.retentionCase.legalHoldReason,
  };
}

function selectCanonicalIdentityHold(
  holds: Array<{
    holdReason: RetentionCaseReason;
    holdUntil: Date | null;
    createdAt: Date;
    retentionCase: { legalHoldReason: LegalHoldReason | null };
  }>,
) {
  return [...holds].sort((left, right) => {
    const priorityDelta =
      retentionHoldPriority(left.holdReason) - retentionHoldPriority(right.holdReason);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }
    return right.createdAt.getTime() - left.createdAt.getTime();
  })[0];
}

function retentionHoldPriority(reason: string) {
  switch (reason) {
    case 'LEGAL_HOLD':
      return 0;
    case 'ADMIN_MANUAL':
      return 1;
    case 'DISPUTE_RESPONSE':
      return 2;
    case 'REPORT_REVIEW':
      return 3;
    case 'ENFORCEMENT_RECORD':
      return 4;
    case 'ACCOUNT_DELETION':
      return 5;
    default:
      return 99;
  }
}

import type { Prisma } from '../generated/prisma/client.js';
import type { ArchiveJobStatus, ArchiveJobTarget, ArchiveTier } from '../generated/prisma/enums.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import {
  ensureRetentionCaseTx,
  retainVaultPayloadTx,
  type RetainedVaultOwnerOptions,
} from './retained-vault-owner.js';
import {
  createConversationRetainedBodyOwner,
  type ConversationRetainedBodyOwnerOptions,
} from './conversation-retained-body-owner.js';

const DEFAULT_MAX_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 60 * 60 * 1_000;
const CHAT_MESSAGE_IDENTITY_REVIEW_AFTER_DAYS = 365 * 2;
const DEIDENTIFIED_DISPLAY_LABEL = '탈퇴한 사용자';

const deletionArchiveJobTargets = [
  'RETAINED_IDENTITY',
  'SEASON_PROFILE_HISTORY',
  'MATCH_HISTORY',
  'THREAD_RETENTION',
  'NICKNAME_AUDIT',
] satisfies ArchiveJobTarget[];

const archiveJobWorkItemSelect = {
  id: true,
  target: true,
  status: true,
  archiveTier: true,
  retainedIdentityId: true,
  userId: true,
  seasonId: true,
  participantId: true,
  matchHistoryEntryId: true,
  threadId: true,
  attemptCount: true,
  maxAttempts: true,
  nextRunAt: true,
  lastErrorCode: true,
  manualReviewRequired: true,
  payload: true,
} as const;

type ArchiveJobWorkItem = Prisma.ArchiveJobGetPayload<{
  select: typeof archiveJobWorkItemSelect;
}>;

interface ArchiveDeletionJobHandlerContext {
  prisma: PrismaService;
  job: ArchiveJobWorkItem;
  now: Date;
  conversationRetention: ReturnType<typeof createConversationRetainedBodyOwner>;
  retainedVaultOptions: RetainedVaultOwnerOptions;
}

type ArchiveDeletionJobHandler = (
  context: ArchiveDeletionJobHandlerContext,
) => Promise<ArchiveStorageResult>;

const hotDbArchiveJobHandlers = {
  THREAD_RETENTION: ({ prisma, job, now, conversationRetention }) =>
    archiveThreadRetentionJob(prisma, job, now, conversationRetention),
  RETAINED_IDENTITY: ({ prisma, job }) => archiveRetainedIdentityJob(prisma, job),
  NICKNAME_AUDIT: ({ prisma, job, now, retainedVaultOptions }) =>
    archiveNicknameAuditJob(prisma, job, now, retainedVaultOptions),
  SEASON_PROFILE_HISTORY: ({ prisma, job, now, retainedVaultOptions }) =>
    archiveSeasonProfileHistoryJob(prisma, job, now, retainedVaultOptions),
  MATCH_HISTORY: ({ prisma, job, now, retainedVaultOptions }) =>
    archiveMatchHistoryJob(prisma, job, now, retainedVaultOptions),
} satisfies Partial<Record<ArchiveJobTarget, ArchiveDeletionJobHandler>>;

export interface ArchiveStorageResult {
  ok: boolean;
  errorCode?: string;
  waitingCondition?: boolean;
}

export interface ArchiveStoragePort {
  archive(job: ArchiveJobWorkItem): Promise<ArchiveStorageResult>;
}

export interface ArchiveJobOwnerOptions {
  archiveStorage?: ArchiveStoragePort;
  conversationRetention?: ConversationRetainedBodyOwnerOptions;
  retainedVault?: RetainedVaultOwnerOptions;
}

export class HotDbArchiveAdapter implements ArchiveStoragePort {
  archive(job: ArchiveJobWorkItem): Promise<ArchiveStorageResult> {
    if (job.archiveTier !== 'HOT_DB') {
      return Promise.resolve({ ok: false, errorCode: 'UNSUPPORTED_ARCHIVE_TIER' });
    }

    if (job.manualReviewRequired) {
      return Promise.resolve({ ok: false, errorCode: 'MANUAL_REVIEW_REQUIRED' });
    }

    return Promise.resolve({ ok: true });
  }
}

export interface DeletionArchiveJobInput {
  retainedIdentityId: string;
  userId: string;
  deletedAt: Date;
}

export interface ArchiveJobSweepResult {
  processedCount: number;
  succeededCount: number;
  retryScheduledCount: number;
  manualReviewCount: number;
  waitingConditionCount: number;
}

export interface ArchiveJobActivationResult {
  activatedCount: number;
}

export function createArchiveJobOwner(prisma: PrismaService, options: ArchiveJobOwnerOptions = {}) {
  return {
    async retryDueArchiveJobs(now: Date): Promise<ArchiveJobSweepResult> {
      return retryDueArchiveJobs(
        prisma,
        now,
        options.archiveStorage ?? new HotDbArchiveAdapter(),
        options.conversationRetention,
        options.retainedVault,
      );
    },
    async activateThreadRetentionJobsForArchivedThreads(
      now: Date,
    ): Promise<ArchiveJobActivationResult> {
      return activateThreadRetentionJobsForArchivedThreads(prisma, now);
    },
  };
}

export async function createDeletionArchiveJobsTx(
  tx: Prisma.TransactionClient,
  input: DeletionArchiveJobInput,
) {
  const participantRows = await tx.seasonParticipant.findMany({
    where: { userId: input.userId },
    select: { id: true, seasonId: true },
    orderBy: { id: 'asc' },
  });
  const participantIds = participantRows.map((participant) => participant.id);

  const seasonProfileHistories =
    participantIds.length > 0
      ? await tx.seasonParticipantProfileHistory.findMany({
          where: { participantId: { in: participantIds } },
          select: { participantId: true, seasonId: true },
          distinct: ['participantId'],
          orderBy: [{ participantId: 'asc' }, { createdAt: 'desc' }],
        })
      : [];

  const matchHistoryEntries =
    participantIds.length > 0
      ? await tx.seasonMatchHistoryEntry.findMany({
          where: {
            OR: [
              { viewerParticipantId: { in: participantIds } },
              { counterpartParticipantId: { in: participantIds } },
            ],
          },
          select: { id: true, seasonId: true },
          orderBy: { id: 'asc' },
        })
      : [];

  const threads =
    participantIds.length > 0
      ? await tx.conversationThread.findMany({
          where: {
            OR: [
              { participantAId: { in: participantIds } },
              { participantBId: { in: participantIds } },
            ],
          },
          select: {
            id: true,
            seasonId: true,
            status: true,
          },
          orderBy: { id: 'asc' },
        })
      : [];

  await tx.userDisplayIdentityNicknameChangeEvent.updateMany({
    where: { userId: input.userId, retainedIdentityId: null },
    data: { retainedIdentityId: input.retainedIdentityId },
  });

  const jobs: Prisma.ArchiveJobCreateManyInput[] = [
    buildArchiveJob({
      target: 'RETAINED_IDENTITY',
      retainedIdentityId: input.retainedIdentityId,
      userId: input.userId,
      deletedAt: input.deletedAt,
    }),
    buildArchiveJob({
      target: 'NICKNAME_AUDIT',
      retainedIdentityId: input.retainedIdentityId,
      userId: input.userId,
      deletedAt: input.deletedAt,
    }),
  ];

  for (const history of seasonProfileHistories) {
    jobs.push(
      buildArchiveJob({
        target: 'SEASON_PROFILE_HISTORY',
        retainedIdentityId: input.retainedIdentityId,
        userId: input.userId,
        seasonId: history.seasonId,
        participantId: history.participantId,
        deletedAt: input.deletedAt,
      }),
    );
  }

  for (const entry of matchHistoryEntries) {
    jobs.push(
      buildArchiveJob({
        target: 'MATCH_HISTORY',
        retainedIdentityId: input.retainedIdentityId,
        userId: input.userId,
        seasonId: entry.seasonId,
        matchHistoryEntryId: entry.id,
        deletedAt: input.deletedAt,
      }),
    );
  }

  for (const thread of threads) {
    jobs.push(
      buildArchiveJob({
        target: 'THREAD_RETENTION',
        retainedIdentityId: input.retainedIdentityId,
        userId: input.userId,
        seasonId: thread.seasonId,
        threadId: thread.id,
        deletedAt: input.deletedAt,
        status: thread.status === 'ARCHIVED' ? 'PENDING' : 'WAITING_CONDITION',
        payload: {
          retentionMode: 'CHAT_THREAD_ARCHIVE',
          identityReviewAfter: addDays(
            input.deletedAt,
            CHAT_MESSAGE_IDENTITY_REVIEW_AFTER_DAYS,
          ).toISOString(),
          waitingFor: thread.status === 'ARCHIVED' ? undefined : 'THREAD_ARCHIVED',
        },
      }),
    );
  }

  const result = await tx.archiveJob.createMany({ data: jobs });
  return { createdCount: result.count };
}

export async function activateThreadRetentionJobsForArchivedThreads(
  prisma: Pick<PrismaService, 'archiveJob' | 'conversationThread'>,
  now: Date,
): Promise<ArchiveJobActivationResult> {
  const waitingJobs = await prisma.archiveJob.findMany({
    where: {
      target: 'THREAD_RETENTION',
      status: 'WAITING_CONDITION',
      threadId: { not: null },
    },
    select: { id: true, threadId: true },
    orderBy: [{ nextRunAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  });

  const threadIds = [
    ...new Set(waitingJobs.flatMap((job) => (job.threadId ? [job.threadId] : []))),
  ];
  if (threadIds.length === 0) {
    return { activatedCount: 0 };
  }

  const archivedThreads = await prisma.conversationThread.findMany({
    where: { id: { in: threadIds }, status: 'ARCHIVED' },
    select: { id: true },
  });
  const archivedThreadIds = new Set(archivedThreads.map((thread) => thread.id));
  const activatedJobIds = waitingJobs
    .filter((job) => job.threadId && archivedThreadIds.has(job.threadId))
    .map((job) => job.id);

  if (activatedJobIds.length === 0) {
    return { activatedCount: 0 };
  }

  const result = await prisma.archiveJob.updateMany({
    where: { id: { in: activatedJobIds } },
    data: {
      status: 'PENDING',
      nextRunAt: now,
      lastErrorCode: null,
      manualReviewRequired: false,
    },
  });

  return { activatedCount: result.count };
}

export async function retryDueArchiveJobs(
  prisma: PrismaService,
  now: Date,
  archiveStorage: ArchiveStoragePort = new HotDbArchiveAdapter(),
  conversationRetentionOptions: ConversationRetainedBodyOwnerOptions = {},
  retainedVaultOptions: RetainedVaultOwnerOptions = {},
): Promise<ArchiveJobSweepResult> {
  const dueJobs = await prisma.archiveJob.findMany({
    where: {
      target: { in: deletionArchiveJobTargets },
      status: { in: ['PENDING', 'RETRY_SCHEDULED'] },
      nextRunAt: { lte: now },
    },
    select: archiveJobWorkItemSelect,
    orderBy: [{ nextRunAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  });

  const result: ArchiveJobSweepResult = {
    processedCount: 0,
    succeededCount: 0,
    retryScheduledCount: 0,
    manualReviewCount: 0,
    waitingConditionCount: 0,
  };
  const conversationRetention = createConversationRetainedBodyOwner(conversationRetentionOptions);

  for (const job of dueJobs) {
    result.processedCount += 1;

    if (job.manualReviewRequired) {
      await markArchiveJobForManualReview(prisma, job, now, 'MANUAL_REVIEW_REQUIRED');
      result.manualReviewCount += 1;
      continue;
    }

    const archiveResult = await archiveDeletionJob(
      prisma,
      job,
      now,
      archiveStorage,
      conversationRetention,
      retainedVaultOptions,
    );

    if (archiveResult.waitingCondition) {
      await prisma.archiveJob.update({
        where: { id: job.id },
        data: {
          status: 'WAITING_CONDITION',
          nextRunAt: now,
          lastErrorCode: archiveResult.errorCode ?? 'WAITING_CONDITION',
          manualReviewRequired: false,
        },
      });
      result.waitingConditionCount += 1;
      continue;
    }

    const attemptCount = job.attemptCount + 1;
    if (archiveResult.ok) {
      await prisma.archiveJob.update({
        where: { id: job.id },
        data: {
          status: 'SUCCEEDED',
          attemptCount,
          lastAttemptAt: now,
          lastSucceededAt: now,
          lastErrorCode: null,
          manualReviewRequired: false,
        },
      });
      result.succeededCount += 1;
      continue;
    }

    const lastErrorCode = archiveResult.errorCode ?? 'ARCHIVE_STORAGE_ERROR';
    if (attemptCount >= job.maxAttempts) {
      await markArchiveJobForManualReview(prisma, job, now, lastErrorCode, attemptCount);
      result.manualReviewCount += 1;
      continue;
    }

    await prisma.archiveJob.update({
      where: { id: job.id },
      data: {
        status: 'RETRY_SCHEDULED',
        attemptCount,
        nextRunAt: resolveNextRetryAt(now, attemptCount),
        lastAttemptAt: now,
        lastErrorCode,
      },
    });
    result.retryScheduledCount += 1;
  }

  return result;
}

async function archiveDeletionJob(
  prisma: PrismaService,
  job: ArchiveJobWorkItem,
  now: Date,
  archiveStorage: ArchiveStoragePort,
  conversationRetention: ReturnType<typeof createConversationRetainedBodyOwner>,
  retainedVaultOptions: RetainedVaultOwnerOptions = {},
): Promise<ArchiveStorageResult> {
  if (job.archiveTier !== 'HOT_DB') {
    return archiveStorage.archive(job);
  }

  const handler = hotDbArchiveJobHandlers[job.target];
  if (!handler) {
    return archiveStorage.archive(job);
  }

  return handler({ prisma, job, now, conversationRetention, retainedVaultOptions });
}

async function archiveRetainedIdentityJob(
  prisma: Pick<PrismaService, 'retainedIdentity'>,
  job: ArchiveJobWorkItem,
): Promise<ArchiveStorageResult> {
  if (!job.retainedIdentityId) {
    return { ok: false, errorCode: 'RETAINED_IDENTITY_ID_MISSING' };
  }

  const retainedIdentity = await prisma.retainedIdentity.findUnique({
    where: { id: job.retainedIdentityId },
    select: {
      id: true,
      retentionReason: true,
      retentionHoldUntil: true,
      retentionDisposedAt: true,
      encryptedIdentifierPayload: true,
      identifierKeyVersion: true,
    },
  });
  if (!retainedIdentity) {
    return { ok: false, errorCode: 'RETAINED_IDENTITY_NOT_FOUND' };
  }
  if (retainedIdentity.retentionDisposedAt) {
    return { ok: false, errorCode: 'RETAINED_IDENTITY_ALREADY_DISPOSED' };
  }
  if (!retainedIdentity.encryptedIdentifierPayload || !retainedIdentity.identifierKeyVersion) {
    return { ok: false, errorCode: 'RETAINED_IDENTITY_IDENTIFIER_PAYLOAD_MISSING' };
  }

  return { ok: true };
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
            previousNickname: DEIDENTIFIED_DISPLAY_LABEL,
            previousNicknameNormalized: `redacted-${event.id}`,
            nextNickname: DEIDENTIFIED_DISPLAY_LABEL,
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
            nicknameSnapshot: DEIDENTIFIED_DISPLAY_LABEL,
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
          counterpartNicknameSnapshot: DEIDENTIFIED_DISPLAY_LABEL,
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
      conversationRetention.retainAndTombstoneThreadMessagesTx(tx, {
        threadId: thread.id,
        archiveJobId: job.id,
        triggerUserId: job.userId,
        triggerRetainedIdentityId: job.retainedIdentityId,
        now,
        metadata: {
          archiveJobId: job.id,
          archiveJobTarget: job.target,
        },
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

function buildArchiveJob(input: {
  target: ArchiveJobTarget;
  retainedIdentityId: string;
  userId: string;
  deletedAt: Date;
  seasonId?: string;
  participantId?: string;
  matchHistoryEntryId?: string;
  threadId?: string;
  status?: ArchiveJobStatus;
  manualReviewRequired?: boolean;
  payload?: Record<string, unknown>;
}): Prisma.ArchiveJobCreateManyInput {
  const manualReviewRequired = input.manualReviewRequired ?? false;
  const status = input.status ?? (manualReviewRequired ? 'FAILED_MANUAL_REVIEW' : 'PENDING');

  return {
    target: input.target,
    status,
    archiveTier: 'HOT_DB' satisfies ArchiveTier,
    retainedIdentityId: input.retainedIdentityId,
    userId: input.userId,
    seasonId: input.seasonId,
    participantId: input.participantId,
    matchHistoryEntryId: input.matchHistoryEntryId,
    threadId: input.threadId,
    attemptCount: 0,
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    nextRunAt: input.deletedAt,
    manualReviewRequired,
    lastErrorCode: manualReviewRequired ? 'MANUAL_REVIEW_REQUIRED' : undefined,
    payload: buildArchiveJobPayload(input) as Prisma.InputJsonValue,
  };
}

function buildArchiveJobPayload(input: {
  target: ArchiveJobTarget;
  deletedAt: Date;
  payload?: Record<string, unknown>;
}) {
  return removeUndefinedValues({
    schemaVersion: 1,
    source: 'ACCOUNT_DELETE',
    target: input.target,
    deletedAt: input.deletedAt.toISOString(),
    ...(input.payload ?? {}),
  });
}

async function markArchiveJobForManualReview(
  prisma: Pick<PrismaService, 'archiveJob'>,
  job: Pick<ArchiveJobWorkItem, 'id' | 'attemptCount'>,
  now: Date,
  errorCode: string,
  attemptCount: number = job.attemptCount,
) {
  await prisma.archiveJob.update({
    where: { id: job.id },
    data: {
      status: 'FAILED_MANUAL_REVIEW' satisfies ArchiveJobStatus,
      attemptCount,
      lastAttemptAt: now,
      lastErrorCode: errorCode,
      manualReviewRequired: true,
    },
  });
}

function resolveNextRetryAt(now: Date, attemptCount: number) {
  return new Date(now.getTime() + RETRY_BASE_DELAY_MS * Math.max(1, attemptCount));
}

async function loadRetainedIdentityForCase(
  tx: Prisma.TransactionClient,
  retainedIdentityId: string,
) {
  const retainedIdentity = await tx.retainedIdentity.findUnique({
    where: { id: retainedIdentityId },
    select: {
      retentionReason: true,
      retentionHoldUntil: true,
      legalHoldReason: true,
    },
  });
  if (!retainedIdentity) {
    throw new Error('RETAINED_IDENTITY_NOT_FOUND');
  }

  return {
    retentionCaseReason: toRetentionCaseReason(retainedIdentity.retentionReason),
    retentionHoldUntil: retainedIdentity.retentionHoldUntil,
    legalHoldReason: retainedIdentity.legalHoldReason,
  };
}

function toRetentionCaseReason(reason: string) {
  switch (reason) {
    case 'ACCOUNT_DELETION':
    case 'REPORT_REVIEW':
    case 'ENFORCEMENT_RECORD':
    case 'DISPUTE_RESPONSE':
    case 'LEGAL_HOLD':
    case 'ADMIN_MANUAL':
      return reason;
    default:
      return 'ACCOUNT_DELETION';
  }
}

function toArchiveStorageError(error: unknown, fallback: string): ArchiveStorageResult {
  return {
    ok: false,
    errorCode: error instanceof Error ? normalizeArchiveErrorCode(error.message) : fallback,
  };
}

function buildJobMetadata(job: ArchiveJobWorkItem): Record<string, unknown> {
  return removeUndefinedValues({
    archiveJobId: job.id,
    archiveJobTarget: job.target,
    retainedIdentityId: job.retainedIdentityId,
    userId: job.userId,
    seasonId: job.seasonId,
    participantId: job.participantId,
    matchHistoryEntryId: job.matchHistoryEntryId,
    threadId: job.threadId,
  });
}

function buildVaultAad(target: string, sourceId: string) {
  return `knu-roommate:retained-vault:${target}:v1:${sourceId}`;
}

function toVaultJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(toJsonSerializable(value))) as Prisma.InputJsonValue;
}

function toJsonSerializable(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((entry) => toJsonSerializable(entry));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        toJsonSerializable(entry),
      ]),
    );
  }
  return value;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1_000);
}

function normalizeArchiveErrorCode(message: string) {
  return (
    message
      .replace(/^\[[^\]]+\]\s*/, '')
      .replace(/[^A-Z0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase()
      .slice(0, 80) || 'THREAD_RETENTION_ARCHIVE_ERROR'
  );
}

function removeUndefinedValues(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

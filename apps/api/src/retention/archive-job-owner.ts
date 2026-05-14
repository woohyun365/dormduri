import type { Prisma } from '../generated/prisma/client.js';
import type { ArchiveJobStatus, ArchiveJobTarget, ArchiveTier } from '../generated/prisma/enums.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import {
  createConversationRetainedBodyOwner,
  type ConversationRetainedBodyOwnerOptions,
} from './conversation-retained-body-owner.js';

const DEFAULT_MAX_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 60 * 60 * 1_000;
const CHAT_MESSAGE_IDENTITY_REVIEW_AFTER_DAYS = 365 * 2;

const deletionArchiveJobTargets = [
  'RETAINED_IDENTITY',
  'USER_PROFILE_HISTORY',
  'SEASON_PROFILE_HISTORY',
  'MATCH_HISTORY',
  'THREAD_RETENTION',
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

  const userProfileHistoryCount = await tx.userProfileHistory.count({
    where: { userId: input.userId },
  });

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

  const jobs: Prisma.ArchiveJobCreateManyInput[] = [
    buildArchiveJob({
      target: 'RETAINED_IDENTITY',
      retainedIdentityId: input.retainedIdentityId,
      userId: input.userId,
      deletedAt: input.deletedAt,
    }),
  ];

  if (userProfileHistoryCount > 0) {
    jobs.push(
      buildArchiveJob({
        target: 'USER_PROFILE_HISTORY',
        retainedIdentityId: input.retainedIdentityId,
        userId: input.userId,
        deletedAt: input.deletedAt,
        payload: { historyCount: userProfileHistoryCount },
      }),
    );
  }

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
          retentionMode: 'INDEFINITE_LOGICAL_ARCHIVE',
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

    const archiveResult =
      job.target === 'THREAD_RETENTION'
        ? await archiveThreadRetentionJob(prisma, job, now, conversationRetention)
        : await archiveStorage.archive(job);

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

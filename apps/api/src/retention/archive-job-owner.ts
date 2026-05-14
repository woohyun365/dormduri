import type { Prisma } from '../generated/prisma/client.js';
import type { ArchiveJobStatus, ArchiveJobTarget, ArchiveTier } from '../generated/prisma/enums.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';

const DEFAULT_MAX_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 60 * 60 * 1_000;

const deletionArchiveJobTargets = [
  'RETAINED_IDENTITY',
  'USER_PROFILE_HISTORY',
  'SEASON_PROFILE_HISTORY',
  'MATCH_HISTORY',
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

export function createArchiveJobOwner(prisma: PrismaService, options: ArchiveJobOwnerOptions = {}) {
  return {
    async retryDueArchiveJobs(now: Date): Promise<ArchiveJobSweepResult> {
      return retryDueArchiveJobs(prisma, now, options.archiveStorage ?? new HotDbArchiveAdapter());
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

  const result = await tx.archiveJob.createMany({ data: jobs });
  return { createdCount: result.count };
}

export async function retryDueArchiveJobs(
  prisma: PrismaService,
  now: Date,
  archiveStorage: ArchiveStoragePort = new HotDbArchiveAdapter(),
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

  for (const job of dueJobs) {
    result.processedCount += 1;

    if (job.manualReviewRequired) {
      await markArchiveJobForManualReview(prisma, job, now, 'MANUAL_REVIEW_REQUIRED');
      result.manualReviewCount += 1;
      continue;
    }

    const archiveResult = await archiveStorage.archive(job);
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

function buildArchiveJob(input: {
  target: ArchiveJobTarget;
  retainedIdentityId: string;
  userId: string;
  deletedAt: Date;
  seasonId?: string;
  participantId?: string;
  matchHistoryEntryId?: string;
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

function removeUndefinedValues(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

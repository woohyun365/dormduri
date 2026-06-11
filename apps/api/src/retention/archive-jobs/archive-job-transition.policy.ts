import type { ArchiveJobStatus } from '../../generated/prisma/enums.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import type { ArchiveJobWorkItem, ArchiveStorageResult } from './archive-job.types.js';

export const ARCHIVE_JOB_RETRY_BASE_DELAY_MS = 60 * 60 * 1_000;

export function resolveNextArchiveRetryAt(now: Date, attemptCount: number) {
  return new Date(now.getTime() + ARCHIVE_JOB_RETRY_BASE_DELAY_MS * Math.max(1, attemptCount));
}

export function shouldMarkArchiveJobForManualReview(input: {
  attemptCount: number;
  maxAttempts: number;
}) {
  return input.attemptCount >= input.maxAttempts;
}

export async function markArchiveJobForManualReview(
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

export function toArchiveStorageError(error: unknown, fallback: string): ArchiveStorageResult {
  return {
    ok: false,
    errorCode: error instanceof Error ? normalizeArchiveErrorCode(error.message) : fallback,
  };
}

export function normalizeArchiveErrorCode(message: string) {
  return (
    message
      .replace(/^\[[^\]]+\]\s*/, '')
      .replace(/[^A-Z0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase()
      .slice(0, 80) || 'THREAD_RETENTION_ARCHIVE_ERROR'
  );
}

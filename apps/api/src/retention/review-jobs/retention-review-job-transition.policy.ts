import type { ArchiveJobStatus } from '../../generated/prisma/enums.js';

export const RETENTION_REVIEW_RETRY_BASE_DELAY_MS = 60 * 60 * 1_000;

export function calculateRetentionReviewRetryDueAt(now: Date, attemptCount: number) {
  return new Date(now.getTime() + RETENTION_REVIEW_RETRY_BASE_DELAY_MS * Math.max(1, attemptCount));
}

export function shouldMarkRetentionReviewForManualReview(input: {
  attemptCount: number;
  maxAttempts: number;
}) {
  return input.attemptCount >= input.maxAttempts;
}

export function failedManualReviewStatus(): ArchiveJobStatus {
  return 'FAILED_MANUAL_REVIEW';
}

export function normalizeRetentionReviewErrorCode(message: string) {
  return (
    message
      .replace(/^\[[^\]]+\]\s*/, '')
      .replace(/[^A-Z0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase()
      .slice(0, 80) || 'RETENTION_REVIEW_ERROR'
  );
}

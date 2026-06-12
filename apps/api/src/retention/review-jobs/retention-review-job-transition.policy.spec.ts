import { describe, expect, it } from 'vitest';
import {
  calculateRetentionReviewRetryDueAt,
  normalizeRetentionReviewErrorCode,
  shouldMarkRetentionReviewForManualReview,
} from './retention-review-job-transition.policy.js';

describe('retention review job transition policy', () => {
  it('attempt count 기반 1시간 단위 retry dueAt을 계산한다', () => {
    const now = new Date('2029-01-01T00:00:00.000Z');

    expect(calculateRetentionReviewRetryDueAt(now, 2)).toEqual(
      new Date('2029-01-01T02:00:00.000Z'),
    );
  });

  it('maxAttempts에 도달하면 manual review 전환 대상으로 판단한다', () => {
    expect(shouldMarkRetentionReviewForManualReview({ attemptCount: 5, maxAttempts: 5 })).toBe(
      true,
    );
    expect(shouldMarkRetentionReviewForManualReview({ attemptCount: 4, maxAttempts: 5 })).toBe(
      false,
    );
  });

  it('error message를 80자 이내 대문자 error code로 정규화한다', () => {
    expect(normalizeRetentionReviewErrorCode('[Prisma] timeout while querying DB')).toBe(
      'TIMEOUT_WHILE_QUERYING_DB',
    );
    expect(normalizeRetentionReviewErrorCode('')).toBe('RETENTION_REVIEW_ERROR');
  });
});

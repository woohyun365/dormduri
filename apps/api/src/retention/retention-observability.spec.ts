import {
  buildRetentionOperationalAlerts,
  buildRetentionSweepEmission,
  type RetentionBacklogSnapshot,
} from './retention-observability.js';
import type { LifecycleSweepResult } from '../common/lifecycle/lifecycle-sweep.service.js';

describe('retention-observability', () => {
  it('manual review/retry exhaustion/key unavailable를 운영 alert로 분리한다', () => {
    const snapshot: RetentionBacklogSnapshot = {
      archiveDueCount: 0,
      archiveManualReviewCount: 2,
      archiveRetryExhaustedCount: 1,
      retentionReviewDueCount: 0,
      retentionReviewManualReviewCount: 1,
      retainedVaultObjectCount: 3,
      disposedVaultObjectCount: 4,
      retainedIdentityDisposalDueCount: 0,
      accessLogDisposalDueCount: 0,
      keyUnavailableCount: 1,
    };

    const alerts = buildRetentionOperationalAlerts(snapshot, '2026-05-26T00:00:00.000Z');

    expect(alerts.map((alert) => alert.type)).toEqual([
      'RETENTION_ARCHIVE_MANUAL_REVIEW',
      'RETENTION_REVIEW_MANUAL_REVIEW',
      'RETENTION_RETRY_EXHAUSTED',
      'RETENTION_KEY_UNAVAILABLE',
    ]);
    expect(alerts.filter((alert) => alert.severity === 'critical')).toHaveLength(2);
  });

  it('sweep result와 DB backlog를 metric signal로 변환한다', async () => {
    const prisma = {
      archiveJob: {
        count: jest.fn().mockResolvedValue(7),
        findMany: jest
          .fn()
          .mockResolvedValue([
            { attemptCount: 5, maxAttempts: 5, lastErrorCode: 'CHAT_BODY_KEY_UNAVAILABLE' },
          ]),
      },
      retentionReviewJob: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([]),
      },
      retainedVaultObject: {
        count: jest.fn().mockResolvedValueOnce(11).mockResolvedValueOnce(13),
      },
      retainedIdentity: {
        count: jest.fn().mockResolvedValue(17),
      },
      retentionAccessLog: {
        count: jest.fn().mockResolvedValue(19),
      },
    };

    const emission = await buildRetentionSweepEmission({
      prisma: prisma as never,
      result: makeSweepResult({ accessLogDisposedCount: 23 }),
      now: new Date('2026-05-26T00:00:00.000Z'),
      durationMs: 456,
    });

    expect(metricValue(emission.metrics, 'retention.archive.jobs.due')).toBe(7);
    expect(metricValue(emission.metrics, 'retention.review.jobs.due')).toBe(2);
    expect(metricValue(emission.metrics, 'retention.vault.objects.retained')).toBe(11);
    expect(metricValue(emission.metrics, 'retention.vault.objects.disposed')).toBe(13);
    expect(metricValue(emission.metrics, 'retention.identity.disposal.due')).toBe(17);
    expect(metricValue(emission.metrics, 'retention.access_log.disposal.due')).toBe(19);
    expect(metricValue(emission.metrics, 'retention.access_log.disposed')).toBe(23);
    expect(metricValue(emission.metrics, 'retention.sweep.duration_ms')).toBe(456);
    expect(metricValue(emission.metrics, 'retention.key.unavailable')).toBe(1);
    expect(emission.alerts.map((alert) => alert.type)).toEqual(
      expect.arrayContaining(['RETENTION_ARCHIVE_MANUAL_REVIEW', 'RETENTION_KEY_UNAVAILABLE']),
    );
  });
});

function metricValue(
  metrics: Array<{ name: string; value: number }>,
  name: string,
): number | undefined {
  return metrics.find((metric) => metric.name === name)?.value;
}

function makeSweepResult(input: { accessLogDisposedCount: number }): LifecycleSweepResult {
  return {
    ranAt: '2026-05-26T00:00:00.000Z',
    matchTransitions: {},
    threadTransitions: {},
    matchHistory: {},
    participantBackfill: {},
    threadRetentionActivationSweep: { activatedCount: 0 },
    archiveJobSweep: {
      processedCount: 0,
      succeededCount: 0,
      retryScheduledCount: 0,
      manualReviewCount: 0,
      waitingConditionCount: 0,
    },
    retainedIdentityDisposalSweep: { processedCount: 0 },
    retentionReviewJobSweep: {
      processedCount: 0,
      succeededCount: 0,
      retryScheduledCount: 0,
      manualReviewCount: 0,
      reviewedCount: 0,
      minimizedCount: 0,
    },
    retentionAccessLogDisposalSweep: {
      processedCount: input.accessLogDisposedCount,
      nextDueAt: null,
    },
  } as LifecycleSweepResult;
}

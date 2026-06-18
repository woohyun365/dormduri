import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import type { DomainMetricsPort } from '../../platform/observability/metrics/domain-metrics.port.js';
import { buildRetentionOperationalAlerts } from './retention-alerts.js';
import { buildRetentionSweepEmission } from './retention-metrics.js';
import { RetentionObservabilityService } from './retention-observability.service.js';
import type { RetentionBacklogSnapshot } from './retention-observability.types.js';
import type { LifecycleSweepResult } from '../../lifecycle/lifecycle-sweep.service.js';

const sensitiveRetentionLogKeys = [
  'encryptedIdentifierPayload',
  'encryptedPayload',
  'decryptedPayload',
  'identifier',
  'identifierValue',
  'approvalReference',
  'purpose',
  'rawPayload',
  'body',
  'conversationBody',
] as const;

describe('retention-observability', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
        count: vi.fn().mockResolvedValue(7),
        findMany: vi
          .fn()
          .mockResolvedValue([
            { attemptCount: 5, maxAttempts: 5, lastErrorCode: 'CHAT_BODY_KEY_UNAVAILABLE' },
          ]),
      },
      retentionReviewJob: {
        count: vi.fn().mockResolvedValue(2),
        findMany: vi.fn().mockResolvedValue([]),
      },
      retainedVaultObject: {
        count: vi.fn().mockResolvedValueOnce(11).mockResolvedValueOnce(13),
      },
      retainedIdentity: {
        count: vi.fn().mockResolvedValue(17),
      },
      retentionAccessLog: {
        count: vi.fn().mockResolvedValue(19),
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

  it('metric/alert logger payload를 allowlist shape와 민감값 없는 metadata로 제한한다', async () => {
    const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const domainMetrics = makeDomainMetrics();
    const service = new RetentionObservabilityService(domainMetrics);
    const prisma = makeBacklogPrisma({ archiveDueCount: 101, keyUnavailableCount: 1 });

    await service.emitSweep({
      prisma: prisma as never,
      result: makeSweepResult({ accessLogDisposedCount: 5 }),
      now: new Date('2026-05-26T00:00:00.000Z'),
      durationMs: 123,
    });
    service.emitSweepFailure({
      mode: 'periodic',
      error: new Error('encryptedPayload=secret identifierValue=student-no'),
      occurredAt: new Date('2026-05-26T00:00:01.000Z'),
    });

    const loggerCalls: unknown[][] = [
      ...(logSpy.mock.calls as unknown[][]),
      ...(warnSpy.mock.calls as unknown[][]),
      ...(errorSpy.mock.calls as unknown[][]),
    ];
    const logPayloads = loggerCalls.flatMap((call): RetentionLogPayload[] => {
      const payload = call[0];
      return isRetentionLogPayload(payload) ? [payload] : [];
    });

    expect(logPayloads.length).toBeGreaterThan(0);
    for (const payload of logPayloads) {
      if ('name' in payload) {
        expect(Object.keys(payload)).toEqual(
          expect.arrayContaining(['event', 'name', 'observedAt', 'value']),
        );
        expect(Object.keys(payload).every((key) => metricLogKeys.has(key))).toBe(true);
      }
      if ('type' in payload) {
        expect(Object.keys(payload).every((key) => alertLogKeys.has(key))).toBe(true);
      }
      const serialized = JSON.stringify(payload);
      for (const sensitiveKey of sensitiveRetentionLogKeys) {
        expect(serialized).not.toContain(sensitiveKey);
      }
    }

    const failureAlert = logPayloads.find(isRetentionSweepFailedLogPayload);

    expect(failureAlert?.metadata).toEqual({ mode: 'periodic', errorName: 'Error' });
    expect(domainMetrics.setGauge).toHaveBeenCalledWith({
      name: 'api_retention_backlog_total',
      labels: { target: 'archive_jobs', state: 'due' },
      value: 101,
    });
    expect(domainMetrics.observeHistogram).toHaveBeenCalledWith({
      name: 'api_retention_sweep_duration_seconds',
      labels: { target: 'all', outcome: 'success' },
      value: 0.123,
    });
    expect(domainMetrics.observeHistogram).toHaveBeenCalledWith({
      name: 'api_retention_sweep_duration_seconds',
      labels: { target: 'all', outcome: 'failure' },
      value: 0,
    });
    expect(JSON.stringify(domainMetrics.setGauge.mock.calls)).not.toContain('identifierValue');
    expect(JSON.stringify(domainMetrics.setGauge.mock.calls)).not.toContain('encryptedPayload');
  });

  it('Prometheus bridge 기록 실패는 retention metric/alert logging을 깨지 않는다', async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const domainMetrics = makeDomainMetrics();
    domainMetrics.setGauge.mockImplementation(() => {
      throw new Error('metric rejected');
    });
    const service = new RetentionObservabilityService(domainMetrics);

    await expect(
      service.emitSweep({
        prisma: makeBacklogPrisma({ archiveDueCount: 1, keyUnavailableCount: 0 }) as never,
        result: makeSweepResult({ accessLogDisposedCount: 0 }),
        now: new Date('2026-05-26T00:00:00.000Z'),
        durationMs: 1,
      }),
    ).resolves.toMatchObject({
      snapshot: { archiveDueCount: 1 },
    });
  });
});

type RetentionLogPayload = Record<string, unknown>;

type RetentionSweepFailedLogPayload = RetentionLogPayload & {
  type: 'RETENTION_SWEEP_FAILED';
  metadata?: Record<string, unknown>;
};

const metricLogKeys = new Set(['event', 'name', 'value', 'observedAt', 'tags']);
const alertLogKeys = new Set([
  'event',
  'type',
  'severity',
  'message',
  'observedAt',
  'count',
  'metadata',
]);

function metricValue(
  metrics: Array<{ name: string; value: number }>,
  name: string,
): number | undefined {
  return metrics.find((metric) => metric.name === name)?.value;
}

function makeBacklogPrisma(input: { archiveDueCount: number; keyUnavailableCount: number }) {
  return {
    archiveJob: {
      count: vi.fn().mockResolvedValue(input.archiveDueCount),
      findMany: vi.fn().mockResolvedValue(
        Array.from({ length: input.keyUnavailableCount }, () => ({
          attemptCount: 5,
          maxAttempts: 5,
          lastErrorCode: 'CHAT_BODY_KEY_UNAVAILABLE',
        })),
      ),
    },
    retentionReviewJob: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    retainedVaultObject: {
      count: vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(0),
    },
    retainedIdentity: {
      count: vi.fn().mockResolvedValue(0),
    },
    retentionAccessLog: {
      count: vi.fn().mockResolvedValue(0),
    },
  };
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

function isRetentionLogPayload(value: unknown): value is RetentionLogPayload {
  return value !== null && typeof value === 'object';
}

function isRetentionSweepFailedLogPayload(
  value: RetentionLogPayload,
): value is RetentionSweepFailedLogPayload {
  return value.type === 'RETENTION_SWEEP_FAILED';
}

function makeDomainMetrics() {
  return {
    incrementCounter: vi.fn(),
    setGauge: vi.fn(),
    observeHistogram: vi.fn(),
  } satisfies DomainMetricsPort;
}

import { describe, expect, it, vi } from 'vitest';
import type { DomainMetricsPort } from '../../platform/observability/metrics/domain-metrics.port.js';
import {
  SeasonOperationalMetricsService,
  assertSeasonOperationMetricPayloadSafe,
  toSeasonOperationMetricPayload,
} from './season-operational-metrics.service.js';

describe('SeasonOperationalMetricsService', () => {
  it('current season query cache 상태와 operations outcome을 no-sensitive snapshot으로 기록한다', () => {
    const domainMetrics = makeDomainMetrics();
    const metrics = new SeasonOperationalMetricsService(domainMetrics);
    const now = new Date('2026-06-06T00:00:00.000Z');

    metrics.recordCurrentSeasonQuery({
      campusCode: 'CHUNCHEON',
      cache: 'miss',
      durationMs: 12.8,
      recordedAt: now,
    });
    metrics.recordCurrentSeasonQuery({
      campusCode: 'CHUNCHEON',
      cache: 'hit',
      durationMs: 1,
      recordedAt: now,
    });
    metrics.recordOperation({
      action: 'UPDATE_SCHEDULE',
      campusCode: 'CHUNCHEON',
      outcome: 'success',
      recordedAt: now,
    });
    metrics.recordOperation({
      action: 'UPDATE_SCHEDULE',
      campusCode: 'CHUNCHEON',
      outcome: 'conflict',
      recordedAt: now,
    });

    expect(metrics.snapshot()).toMatchObject({
      currentSeasonQueries: {
        total: 2,
        cacheHits: 1,
        cacheMisses: 1,
        noCache: 0,
        totalDurationMs: 13,
        lastCampusCode: 'CHUNCHEON',
        lastCache: 'hit',
        lastRecordedAt: now.toISOString(),
      },
      operations: {
        UPDATE_SCHEDULE: {
          totalSuccess: 1,
          totalConflict: 1,
          totalAuditFailure: 0,
          lastCampusCode: 'CHUNCHEON',
          lastOutcome: 'conflict',
          lastRecordedAt: now.toISOString(),
        },
      },
    });
    expect(JSON.stringify(metrics.snapshot())).not.toContain('sessionId');
    expect(JSON.stringify(metrics.snapshot())).not.toContain('reason');
    expect(domainMetrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_seasons_current_query_total',
      labels: { campus: 'CHUNCHEON', cache: 'miss' },
    });
    expect(domainMetrics.observeHistogram).toHaveBeenCalledWith({
      name: 'api_seasons_current_query_duration_seconds',
      labels: { campus: 'CHUNCHEON', cache: 'miss' },
      value: 0.012,
    });
    expect(domainMetrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_seasons_operation_total',
      labels: { action: 'UPDATE_SCHEDULE', campus: 'CHUNCHEON', outcome: 'success' },
    });
    expect(JSON.stringify(domainMetrics.incrementCounter.mock.calls)).not.toContain('actor');
    expect(JSON.stringify(domainMetrics.incrementCounter.mock.calls)).not.toContain('reason');
  });

  it('structured metric payload는 operation/campus/outcome/time allowlist만 허용한다', () => {
    const payload = toSeasonOperationMetricPayload({
      action: 'UPDATE_OVERRIDE',
      campusCode: 'CHUNCHEON',
      outcome: 'audit_failure',
      recordedAt: new Date('2026-06-06T00:00:00.000Z'),
    });

    expect(payload).toEqual({
      action: 'UPDATE_OVERRIDE',
      campusCode: 'CHUNCHEON',
      outcome: 'audit_failure',
      recordedAt: '2026-06-06T00:00:00.000Z',
    });
  });

  it('structured metric payload에 actor/session/reason/snapshot metadata가 들어오면 차단한다', () => {
    expect(() =>
      assertSeasonOperationMetricPayloadSafe({
        action: 'UPDATE_OVERRIDE',
        campusCode: 'CHUNCHEON',
        outcome: 'failure',
        actorUserId: 'admin-user-1',
        sessionId: 'session-1',
        reason: 'manual fix',
        nextSnapshot: { seasonId: 'season-1' },
      }),
    ).toThrow('Unsafe season operation metric payload keys');
  });

  it('Prometheus bridge 기록 실패는 season operation snapshot 기록을 깨지 않는다', () => {
    const domainMetrics = makeDomainMetrics();
    domainMetrics.incrementCounter.mockImplementation(() => {
      throw new Error('metric rejected');
    });
    const metrics = new SeasonOperationalMetricsService(domainMetrics);

    expect(() =>
      metrics.recordOperation({
        action: 'CLEAR_OVERRIDE',
        campusCode: 'CHUNCHEON',
        outcome: 'success',
      }),
    ).not.toThrow();
    expect(metrics.snapshot().operations.CLEAR_OVERRIDE.totalSuccess).toBe(1);
  });
});

function makeDomainMetrics() {
  return {
    incrementCounter: vi.fn(),
    setGauge: vi.fn(),
    observeHistogram: vi.fn(),
  } satisfies DomainMetricsPort;
}

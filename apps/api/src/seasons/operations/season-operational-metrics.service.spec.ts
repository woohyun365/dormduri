import { describe, expect, it } from 'vitest';
import {
  SeasonOperationalMetricsService,
  assertSeasonOperationMetricPayloadSafe,
  toSeasonOperationMetricPayload,
} from './season-operational-metrics.service.js';

describe('SeasonOperationalMetricsService', () => {
  it('current season query cache 상태와 operations outcome을 no-sensitive snapshot으로 기록한다', () => {
    const metrics = new SeasonOperationalMetricsService();
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
});

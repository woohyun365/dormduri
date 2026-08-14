import { describe, expect, it, vi } from 'vitest';
import type { AppLoggerService } from '../platform/observability/logging/app-logger.service.js';
import type { DomainMetricsPort } from '../platform/observability/metrics/domain-metrics.port.js';
import type { HealthReadinessCheckResult } from './checks/health-check.types.js';
import { HealthObservabilityService } from './health-observability.service.js';

describe('HealthObservabilityService', () => {
  it('readiness 결과와 시간을 bounded metric으로 기록한다', () => {
    const metrics = makeMetrics();
    const logger = { write: vi.fn() };
    const service = new HealthObservabilityService(logger as never, metrics);

    service.recordReadiness([result('database', 'up', 'DATABASE_UP')], 25);

    expect(metrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_health_readiness_total',
      labels: { outcome: 'success' },
    });
    expect(metrics.observeHistogram).toHaveBeenCalledWith({
      name: 'api_health_readiness_duration_seconds',
      labels: { outcome: 'success' },
      value: 0.025,
    });
  });

  it('실패 code는 bounded label로 기록하고 동일 상태 log 반복을 피한다', () => {
    const metrics = makeMetrics();
    const logger = { write: vi.fn() };
    const service = new HealthObservabilityService(logger as unknown as AppLoggerService, metrics);
    const checks = [result('database', 'down', 'DATABASE_UNAVAILABLE')];

    service.recordReadiness(checks, 10);
    service.recordReadiness(checks, 11);

    expect(metrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_health_readiness_failures_total',
      labels: { reason: 'DATABASE_UNAVAILABLE' },
    });
    expect(logger.write).toHaveBeenCalledTimes(1);
    expect(logger.write).toHaveBeenCalledWith(
      'warn',
      expect.objectContaining({
        errorCode: 'DATABASE_UNAVAILABLE',
        operation: 'health_readiness',
        outcome: 'failure',
      }),
      'API readiness state changed',
    );
  });
});

function result(
  name: HealthReadinessCheckResult['name'],
  status: HealthReadinessCheckResult['status'],
  code: HealthReadinessCheckResult['code'],
): HealthReadinessCheckResult {
  return {
    name,
    status,
    code,
    checkedAt: '2026-08-12T00:00:00.000Z',
    elapsedMs: 1,
  };
}

function makeMetrics() {
  return {
    incrementCounter: vi.fn(),
    setGauge: vi.fn(),
    observeHistogram: vi.fn(),
  } satisfies DomainMetricsPort;
}

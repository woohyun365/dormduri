import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { DatabaseHealthCheck } from './checks/database-health.check.js';
import type { RuntimeBootstrapHealthCheck } from './checks/runtime-bootstrap-health.check.js';
import type {
  HealthReadinessCheckCode,
  HealthReadinessCheckName,
  HealthReadinessCheckResult,
} from './checks/health-check.types.js';
import type { HealthObservabilityService } from './health-observability.service.js';
import { HealthService } from './health.service.js';

function result(
  name: HealthReadinessCheckName,
  status: 'up' | 'down',
  code: HealthReadinessCheckCode,
): HealthReadinessCheckResult {
  return {
    name,
    status,
    code,
    checkedAt: '2026-06-02T03:00:00.000Z',
    elapsedMs: 1,
  };
}

function createHealthService(overrides: { databaseStatus?: 'up' | 'down' } = {}) {
  const databaseHealthCheck = {
    check: vi
      .fn()
      .mockResolvedValue(
        result(
          'database',
          overrides.databaseStatus ?? 'up',
          overrides.databaseStatus === 'down' ? 'DATABASE_UNAVAILABLE' : 'DATABASE_UP',
        ),
      ),
  };
  const runtimeBootstrapHealthCheck = {
    check: vi
      .fn()
      .mockResolvedValue(result('runtimeBootstrap', 'up', 'RUNTIME_BOOTSTRAP_PREPARED')),
  };
  const observability = { recordReadiness: vi.fn() };

  return {
    service: new HealthService(
      databaseHealthCheck as unknown as DatabaseHealthCheck,
      runtimeBootstrapHealthCheck as unknown as RuntimeBootstrapHealthCheck,
      observability as unknown as HealthObservabilityService,
    ),
    databaseHealthCheck,
    runtimeBootstrapHealthCheck,
    observability,
  };
}

describe('HealthService', () => {
  let uptimeSpy: MockInstance<() => number>;

  beforeEach(() => {
    vi.useFakeTimers().setSystemTime(new Date('2026-06-02T03:00:00.000Z'));
    uptimeSpy = vi.spyOn(process, 'uptime').mockReturnValue(42);
  });

  afterEach(() => {
    uptimeSpy.mockRestore();
    vi.useRealTimers();
  });

  it('liveness는 dependency probe 없이 process status만 반환한다', () => {
    const { service, databaseHealthCheck, runtimeBootstrapHealthCheck } = createHealthService();

    expect(service.getLiveness()).toEqual({
      status: 'ok',
      timestamp: '2026-06-02T03:00:00.000Z',
      uptimeSeconds: 42,
    });
    expect(databaseHealthCheck.check).not.toHaveBeenCalled();
    expect(runtimeBootstrapHealthCheck.check).not.toHaveBeenCalled();
  });

  it('readiness는 DB와 bootstrap receipt만 확인하고 minimal body를 만든다', async () => {
    const { service, observability } = createHealthService();

    await expect(service.getReadiness()).resolves.toEqual({
      status: 'ok',
      failureCodes: [],
    });
    expect(observability.recordReadiness).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'database', status: 'up' }),
        expect.objectContaining({ name: 'runtimeBootstrap', status: 'up' }),
      ]),
      0,
    );
  });

  it('readiness failure는 bounded code만 public body에 포함한다', async () => {
    const { service } = createHealthService({ databaseStatus: 'down' });

    await expect(service.getReadiness()).resolves.toEqual({
      status: 'unavailable',
      failureCodes: ['DATABASE_UNAVAILABLE'],
    });
  });
});

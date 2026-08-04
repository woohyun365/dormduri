import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { HealthService } from './health.service.js';
import type {
  HealthReadinessCheckName,
  HealthReadinessCheckResult,
} from './checks/health-check.types.js';
import type { DatabaseHealthCheck } from './checks/database-health.check.js';
import type { EmailProviderHealthCheck } from './checks/email-provider-health.check.js';
import type { MigrationBaselineHealthCheck } from './checks/migration-baseline-health.check.js';
import type { RuntimeConfigHealthCheck } from './checks/runtime-config-health.check.js';
import type { SecretSourceHealthCheck } from './checks/secret-source-health.check.js';

function result(name: HealthReadinessCheckName, status: 'up' | 'down'): HealthReadinessCheckResult {
  return {
    name,
    status,
    code: status === 'up' ? 'DATABASE_UP' : 'DATABASE_UNAVAILABLE',
    checkedAt: '2026-06-02T03:00:00.000Z',
    elapsedMs: 1,
  };
}

function createHealthService(overrides: { databaseStatus?: 'up' | 'down' } = {}) {
  const databaseHealthCheck = {
    check: vi.fn().mockResolvedValue(result('database', overrides.databaseStatus ?? 'up')),
  };
  const runtimeConfigHealthCheck = {
    check: vi.fn().mockResolvedValue(result('runtimeConfig', 'up')),
  };
  const secretSourceHealthCheck = {
    check: vi.fn().mockResolvedValue(result('secretSource', 'up')),
  };
  const migrationBaselineHealthCheck = {
    check: vi.fn().mockResolvedValue(result('migration', 'up')),
  };
  const emailProviderHealthCheck = {
    check: vi.fn().mockResolvedValue(result('emailProvider', 'up')),
  };
  const metrics = {
    snapshot: vi.fn(() => ({
      connectedSockets: 1,
      totalConnections: 1,
      dispatchers: {
        chat: {
          totalSkippedPublisherUnbound: 1,
          lastSkippedReason: 'PUBLISHER_UNBOUND',
        },
      },
      replayResyncRequired: {
        CURSOR_EXPIRED: 1,
      },
    })),
  };
  const authOperationsHealth = {
    getSnapshot: vi.fn(() => ({
      cleanup: {
        lastBatchSaturatedTargets: [],
      },
    })),
  };

  const service = new HealthService(
    databaseHealthCheck as unknown as DatabaseHealthCheck,
    runtimeConfigHealthCheck as unknown as RuntimeConfigHealthCheck,
    secretSourceHealthCheck as unknown as SecretSourceHealthCheck,
    migrationBaselineHealthCheck as unknown as MigrationBaselineHealthCheck,
    emailProviderHealthCheck as unknown as EmailProviderHealthCheck,
    metrics,
    authOperationsHealth as never,
  );

  return {
    service,
    databaseHealthCheck,
    runtimeConfigHealthCheck,
    secretSourceHealthCheck,
    migrationBaselineHealthCheck,
    emailProviderHealthCheck,
    metrics,
    authOperationsHealth,
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
    const {
      service,
      databaseHealthCheck,
      runtimeConfigHealthCheck,
      metrics,
      authOperationsHealth,
    } = createHealthService();

    expect(service.getLiveness()).toEqual({
      status: 'ok',
      timestamp: '2026-06-02T03:00:00.000Z',
      uptimeSeconds: 42,
    });
    expect(databaseHealthCheck.check).not.toHaveBeenCalled();
    expect(runtimeConfigHealthCheck.check).not.toHaveBeenCalled();
    expect(metrics.snapshot).not.toHaveBeenCalled();
    expect(authOperationsHealth.getSnapshot).not.toHaveBeenCalled();
  });

  it('readiness는 critical checks를 모두 호출하고 success body를 만든다', async () => {
    const {
      service,
      databaseHealthCheck,
      runtimeConfigHealthCheck,
      secretSourceHealthCheck,
      migrationBaselineHealthCheck,
      emailProviderHealthCheck,
    } = createHealthService();

    await expect(service.getReadiness()).resolves.toMatchObject({
      status: 'ok',
      timestamp: '2026-06-02T03:00:00.000Z',
      uptimeSeconds: 42,
      checks: {
        database: { status: 'up' },
        runtimeConfig: { status: 'up' },
        secretSource: { status: 'up' },
        migration: { status: 'up' },
        emailProvider: { status: 'up' },
      },
    });
    expect(databaseHealthCheck.check).toHaveBeenCalledWith();
    expect(runtimeConfigHealthCheck.check).toHaveBeenCalledWith();
    expect(secretSourceHealthCheck.check).toHaveBeenCalledWith();
    expect(migrationBaselineHealthCheck.check).toHaveBeenCalledWith();
    expect(emailProviderHealthCheck.check).toHaveBeenCalledWith();
  });

  it('readiness는 실패 check가 있으면 unavailable로 묶는다', async () => {
    const { service } = createHealthService({ databaseStatus: 'down' });

    await expect(service.getReadiness()).resolves.toMatchObject({
      status: 'unavailable',
      checks: {
        database: {
          status: 'down',
          code: 'DATABASE_UNAVAILABLE',
        },
      },
    });
  });

  it('realtime operations는 dependency probe 없이 no-PII metric snapshot을 반환한다', () => {
    const { service, databaseHealthCheck, metrics, authOperationsHealth } = createHealthService();

    expect(service.getRealtimeOperations()).toMatchObject({
      status: 'ok',
      timestamp: '2026-06-02T03:00:00.000Z',
      uptimeSeconds: 42,
      realtime: {
        connectedSockets: 1,
        totalConnections: 1,
        dispatchers: {
          chat: {
            totalSkippedPublisherUnbound: 1,
            lastSkippedReason: 'PUBLISHER_UNBOUND',
          },
        },
        replayResyncRequired: {
          CURSOR_EXPIRED: 1,
        },
      },
    });
    expect(databaseHealthCheck.check).not.toHaveBeenCalled();
    expect(metrics.snapshot).toHaveBeenCalledWith();
    expect(authOperationsHealth.getSnapshot).not.toHaveBeenCalled();
  });

  it('auth operations는 realtime/dependency probe 없이 cleanup snapshot을 반환한다', () => {
    const { service, databaseHealthCheck, metrics, authOperationsHealth } = createHealthService();

    expect(service.getAuthOperations()).toMatchObject({
      status: 'ok',
      timestamp: '2026-06-02T03:00:00.000Z',
      uptimeSeconds: 42,
      auth: {
        cleanup: {
          lastBatchSaturatedTargets: [],
        },
      },
    });
    expect(databaseHealthCheck.check).not.toHaveBeenCalled();
    expect(metrics.snapshot).not.toHaveBeenCalled();
    expect(authOperationsHealth.getSnapshot).toHaveBeenCalledWith();
  });
});

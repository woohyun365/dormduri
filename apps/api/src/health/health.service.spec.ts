import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { HealthService } from './health.service.js';

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

  it('realtime operations는 DB probe 없이 no-PII metric snapshot을 반환한다', () => {
    const prisma = {
      getDatabaseNow: vi.fn(),
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
      getSnapshot: vi.fn(),
    };

    const service = new HealthService(prisma as never, metrics, authOperationsHealth as never);

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
    expect(prisma.getDatabaseNow).not.toHaveBeenCalled();
    expect(authOperationsHealth.getSnapshot).not.toHaveBeenCalled();
  });

  it('auth operations는 realtime/DB probe 없이 Redis gate와 cleanup/RDS snapshot을 반환한다', () => {
    const prisma = {
      getDatabaseNow: vi.fn(),
    };
    const metrics = {
      snapshot: vi.fn(),
    };
    const authOperationsHealth = {
      getSnapshot: vi.fn(() => ({
        redisGate: {
          decision: 'postgres_authoritative',
          sourceOfTruth: 'postgres',
        },
        cleanup: {
          lastCleanupLagSeconds: 0,
        },
        rdsPoolBudget: {
          activePoolMaxConnections: 30,
        },
      })),
    };

    const service = new HealthService(prisma as never, metrics, authOperationsHealth as never);

    expect(service.getAuthOperations()).toMatchObject({
      status: 'ok',
      timestamp: '2026-06-02T03:00:00.000Z',
      uptimeSeconds: 42,
      auth: {
        redisGate: {
          decision: 'postgres_authoritative',
          sourceOfTruth: 'postgres',
        },
        rdsPoolBudget: {
          activePoolMaxConnections: 30,
        },
      },
    });
    expect(prisma.getDatabaseNow).not.toHaveBeenCalled();
    expect(metrics.snapshot).not.toHaveBeenCalled();
    expect(authOperationsHealth.getSnapshot).toHaveBeenCalledWith();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AUTH_ACCESS_METADATA_KEY,
  AUTH_REQUIRED_CAPABILITIES_METADATA_KEY,
} from '../auth/access/auth-access.decorator.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

describe('HealthController', () => {
  let healthController: HealthController;
  const healthService = {
    getLiveness: vi.fn(),
    getReadiness: vi.fn(),
    getRealtimeOperations: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: healthService,
        },
      ],
    }).compile();

    healthController = app.get<HealthController>(HealthController);
  });

  it('liveness endpoint should return runtime status', () => {
    healthService.getLiveness.mockReturnValue({
      status: 'ok',
      timestamp: '2026-05-08T00:00:00.000Z',
      uptimeSeconds: 42,
    });

    expect(healthController.getLiveness()).toEqual({
      status: 'ok',
      timestamp: '2026-05-08T00:00:00.000Z',
      uptimeSeconds: 42,
    });
  });

  it('readiness endpoint should return dependency checks', async () => {
    healthService.getReadiness.mockResolvedValue({
      status: 'ok',
      timestamp: '2026-05-08T00:00:00.000Z',
      uptimeSeconds: 42,
      checks: {
        database: {
          status: 'up',
          checkedAt: '2026-05-08T00:00:00.000Z',
        },
      },
    });

    await expect(healthController.getReadiness()).resolves.toEqual({
      status: 'ok',
      timestamp: '2026-05-08T00:00:00.000Z',
      uptimeSeconds: 42,
      checks: {
        database: {
          status: 'up',
          checkedAt: '2026-05-08T00:00:00.000Z',
        },
      },
    });
  });

  it('realtime operations endpoint should return no-PII runtime counters', () => {
    healthService.getRealtimeOperations.mockReturnValue({
      status: 'ok',
      timestamp: '2026-05-08T00:00:00.000Z',
      uptimeSeconds: 42,
      realtime: {
        connectedSockets: 2,
        totalConnections: 5,
        publishFailures: 1,
        dispatchers: {
          chat: { totalFailed: 1 },
          notification: { totalFailed: 0 },
        },
        replayResyncRequired: {
          CURSOR_EXPIRED: 1,
        },
      },
    });

    expect(healthController.getRealtimeOperations()).toEqual({
      status: 'ok',
      timestamp: '2026-05-08T00:00:00.000Z',
      uptimeSeconds: 42,
      realtime: {
        connectedSockets: 2,
        totalConnections: 5,
        publishFailures: 1,
        dispatchers: {
          chat: { totalFailed: 1 },
          notification: { totalFailed: 0 },
        },
        replayResyncRequired: {
          CURSOR_EXPIRED: 1,
        },
      },
    });
  });

  it('realtime operations endpoint should be protected by operations health capability', () => {
    const handler = Object.getOwnPropertyDescriptor(
      HealthController.prototype,
      'getRealtimeOperations',
    )?.value as object | undefined;

    if (!handler) {
      throw new Error('Expected HealthController.getRealtimeOperations handler');
    }

    expect(Reflect.getMetadata(AUTH_ACCESS_METADATA_KEY, handler)).toBe('protected');
    expect(Reflect.getMetadata(AUTH_REQUIRED_CAPABILITIES_METADATA_KEY, handler)).toEqual([
      'admin:operations:health:read',
    ]);
  });
});

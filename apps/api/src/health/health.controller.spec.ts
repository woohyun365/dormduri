import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import {
  AUTH_ACCESS_METADATA_KEY,
  AUTH_REQUIRED_CAPABILITIES_METADATA_KEY,
} from '../auth/access/auth-access.decorator.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

function createResponse() {
  const status = vi.fn().mockReturnThis();
  return {
    response: {
      status,
    } as unknown as Response,
    status,
  };
}

describe('HealthController', () => {
  let healthController: HealthController;
  const healthService = {
    getLiveness: vi.fn(),
    getReadiness: vi.fn(),
    getRealtimeOperations: vi.fn(),
    getAuthOperations: vi.fn(),
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

  it('live alias should return the same liveness response', () => {
    healthService.getLiveness.mockReturnValue({
      status: 'ok',
      timestamp: '2026-05-08T00:00:00.000Z',
      uptimeSeconds: 42,
    });

    expect(healthController.getLive()).toEqual({
      status: 'ok',
      timestamp: '2026-05-08T00:00:00.000Z',
      uptimeSeconds: 42,
    });
    expect(healthService.getLiveness).toHaveBeenCalledTimes(1);
  });

  it('readiness endpoint should return dependency checks', async () => {
    healthService.getReadiness.mockResolvedValue({
      status: 'ok',
      timestamp: '2026-05-08T00:00:00.000Z',
      uptimeSeconds: 42,
      checks: {
        database: {
          name: 'database',
          status: 'up',
          code: 'DATABASE_UP',
          checkedAt: '2026-05-08T00:00:00.000Z',
          elapsedMs: 1,
        },
      },
    });
    const { response, status } = createResponse();

    await expect(healthController.getReadiness(response)).resolves.toMatchObject({
      status: 'ok',
      checks: {
        database: {
          status: 'up',
          code: 'DATABASE_UP',
        },
      },
    });
    expect(status).not.toHaveBeenCalled();
  });

  it('readiness endpoint should return 503 for bounded failure body', async () => {
    healthService.getReadiness.mockResolvedValue({
      status: 'unavailable',
      timestamp: '2026-05-08T00:00:00.000Z',
      uptimeSeconds: 42,
      checks: {
        database: {
          name: 'database',
          status: 'down',
          code: 'DATABASE_UNAVAILABLE',
          checkedAt: '2026-05-08T00:00:00.000Z',
          elapsedMs: 1,
        },
      },
    });
    const { response, status } = createResponse();

    await expect(healthController.getReadiness(response)).resolves.toMatchObject({
      status: 'unavailable',
      checks: {
        database: {
          status: 'down',
          code: 'DATABASE_UNAVAILABLE',
        },
      },
    });
    expect(status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
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
    expectCapability('getRealtimeOperations');
  });

  it('auth operations endpoint should be protected by operations health capability', () => {
    expectCapability('getAuthOperations');
  });
});

function expectCapability(handlerName: 'getRealtimeOperations' | 'getAuthOperations') {
  const handler = Object.getOwnPropertyDescriptor(HealthController.prototype, handlerName)
    ?.value as object | undefined;

  if (!handler) {
    throw new Error(`Expected HealthController.${handlerName} handler`);
  }

  expect(Reflect.getMetadata(AUTH_ACCESS_METADATA_KEY, handler)).toBe('protected');
  expect(Reflect.getMetadata(AUTH_REQUIRED_CAPABILITIES_METADATA_KEY, handler)).toEqual([
    'admin:operations:health:read',
  ]);
}

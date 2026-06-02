import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

describe('HealthController', () => {
  let healthController: HealthController;
  const healthService = {
    getLiveness: jest.fn(),
    getReadiness: jest.fn(),
    getRealtimeOperations: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
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
});

import { HttpStatus } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { HttpAdapterHost } from '@nestjs/core';
import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

function createResponse() {
  const status = vi.fn().mockReturnThis();
  return { response: { status } as unknown as Response, status };
}

describe('HealthController', () => {
  let healthController: HealthController;
  const healthService = {
    getLiveness: vi.fn(),
    getReadiness: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthService, useValue: healthService },
        {
          provide: HttpAdapterHost,
          useValue: {
            httpAdapter: {
              status: (response: Response, status: number) => response.status(status),
            },
          },
        },
      ],
    }).compile();
    healthController = app.get(HealthController);
  });

  it('liveness endpoint와 live alias는 process status를 반환한다', () => {
    healthService.getLiveness.mockReturnValue({
      status: 'ok',
      timestamp: '2026-05-08T00:00:00.000Z',
      uptimeSeconds: 42,
    });

    expect(healthController.getLiveness()).toMatchObject({ status: 'ok' });
    expect(healthController.getLive()).toMatchObject({ status: 'ok' });
  });

  it('readiness endpoint는 minimal success body를 반환한다', async () => {
    healthService.getReadiness.mockResolvedValue({ status: 'ok', failureCodes: [] });
    const { response, status } = createResponse();

    await expect(healthController.getReadiness(response)).resolves.toEqual({
      status: 'ok',
      failureCodes: [],
    });
    expect(status).not.toHaveBeenCalled();
  });

  it('readiness endpoint는 bounded failure body와 503을 반환한다', async () => {
    healthService.getReadiness.mockResolvedValue({
      status: 'unavailable',
      failureCodes: ['DATABASE_UNAVAILABLE'],
    });
    const { response, status } = createResponse();

    await expect(healthController.getReadiness(response)).resolves.toEqual({
      status: 'unavailable',
      failureCodes: ['DATABASE_UNAVAILABLE'],
    });
    expect(status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { SeasonsController } from './seasons.controller.js';

function getBadRequestResponse(error: unknown) {
  expect(error).toBeInstanceOf(BadRequestException);

  if (!(error instanceof BadRequestException)) {
    throw new Error('Expected BadRequestException');
  }

  const response = error.getResponse();
  expect(typeof response).toBe('object');
  expect(response).not.toBeNull();

  if (typeof response !== 'object' || response === null) {
    throw new Error('Expected object response');
  }

  return response as {
    code: string;
    fieldErrors?: Record<string, string[]>;
    details?: Array<{ path: string }>;
  };
}

describe('SeasonsController', () => {
  const seasonsService = {
    getCurrentSeason: vi.fn(),
  };

  const controller = new SeasonsController(seasonsService as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invalid campus query는 fieldErrors/details를 포함한 bad request 예외를 던진다', async () => {
    try {
      await controller.getCurrentSeason(undefined);
      throw new Error('Expected getCurrentSeason to throw');
    } catch (error) {
      const response = getBadRequestResponse(error);

      expect(response.code).toBe('SEASONS_INVALID_CAMPUS_QUERY');
      expect(response.fieldErrors?.campus?.length).toBeGreaterThan(0);
      expect(response.details?.some((detail) => detail.path === 'campus')).toBe(true);
    }
  });
});

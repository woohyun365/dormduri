import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { DormitoriesController } from './dormitories.controller.js';

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
    error: string;
    fieldErrors?: Record<string, string[]>;
    details?: Array<{ path: string }>;
  };
}

describe('DormitoriesController', () => {
  const dormitoriesService = {
    getDormitories: vi.fn(),
    getDormitoryById: vi.fn(),
  };

  const controller = new DormitoriesController(dormitoriesService as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invalid campus query는 fieldErrors/details를 포함한 bad request 예외를 던진다', async () => {
    try {
      await controller.getDormitories(undefined, undefined);
      throw new Error('Expected getDormitories to throw');
    } catch (error) {
      const response = getBadRequestResponse(error);

      expect(response.error).toBe('campus 쿼리 파라미터 값이 올바르지 않습니다.');
      expect(response.code).toBe('DORMITORIES_INVALID_CAMPUS_QUERY');
      expect(response.fieldErrors?.campus?.length).toBeGreaterThan(0);
      expect(response.details?.some((detail) => detail.path === 'campus')).toBe(true);
    }
  });

  it('invalid gender query는 gender fieldErrors를 포함한다', async () => {
    try {
      await controller.getDormitories('CHUNCHEON', 'WRONG');
      throw new Error('Expected getDormitories to throw');
    } catch (error) {
      const response = getBadRequestResponse(error);

      expect(response.code).toBe('DORMITORIES_INVALID_GENDER_QUERY');
      expect(response.fieldErrors?.gender?.length).toBeGreaterThan(0);
    }
  });
});

import { BadRequestException } from '@nestjs/common';
import { DormitoriesController } from './dormitories.controller.js';

describe('DormitoriesController', () => {
  const dormitoriesService = {
    getDormitories: jest.fn(),
    getDormitoryById: jest.fn(),
    getDormitoryGuide: jest.fn(),
  };

  const controller = new DormitoriesController(dormitoriesService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invalid campus query는 자연스러운 bad request 예외를 던진다', async () => {
    expect.assertions(3);

    try {
      await controller.getDormitories(undefined, undefined);
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect(error).toBeInstanceOf(Error);

      if (error instanceof BadRequestException) {
        expect(error.getResponse()).toEqual(
          expect.objectContaining({
            error: 'campus 쿼리 파라미터 값이 올바르지 않습니다.',
            code: 'DORMITORIES_INVALID_CAMPUS_QUERY',
          }),
        );
      }
    }
  });
});

import { BadRequestException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { tooManyRequestsError } from './api-error.js';

function createHost(response: { status: jest.Mock; json: jest.Mock }): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'GET',
        originalUrl: '/api/test',
        url: '/api/test',
      }),
      getResponse: () => response,
    }),
  } as ArgumentsHost;
}

describe('ApiExceptionFilter', () => {
  const filter = new ApiExceptionFilter();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('custom extras를 포함한 http exception을 공통 shape로 정규화한다', () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    filter.catch(
      tooManyRequestsError('AUTH_CODE_REQUEST_THROTTLED', '잠시 후 다시 시도해주세요.', {
        retryAfterSeconds: 5,
      }),
      createHost(response),
    );

    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: '잠시 후 다시 시도해주세요.',
        code: 'AUTH_CODE_REQUEST_THROTTLED',
        statusCode: 429,
        path: '/api/test',
        retryAfterSeconds: 5,
      }),
    );
  });

  it('기본 Nest exception도 공통 shape로 정규화한다', () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    filter.catch(new BadRequestException('요청 값이 잘못되었습니다.'), createHost(response));

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: '요청 값이 잘못되었습니다.',
        code: 'BAD_REQUEST',
        statusCode: 400,
        path: '/api/test',
      }),
    );
  });
});

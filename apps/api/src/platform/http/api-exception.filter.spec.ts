import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { tooManyRequestsError } from './api-error.js';
import type { AppLoggerService } from '../observability/logging/app-logger.service.js';

function createHost(response: { status: Mock; json: Mock }): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'GET',
        originalUrl: '/api/test',
        route: { path: '/test' },
        url: '/api/test',
      }),
      getResponse: () => response,
    }),
  } as ArgumentsHost;
}

describe('ApiExceptionFilter', () => {
  const write = vi.fn();
  const recordException = vi.fn();
  const logger = {
    write,
  } as unknown as AppLoggerService;
  const metrics = {
    recordException,
  };
  const filter = new ApiExceptionFilter(logger, metrics as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('custom extras를 포함한 http exception을 공통 shape로 정규화한다', () => {
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
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
    expect(write).toHaveBeenCalledWith(
      'warn',
      expect.objectContaining({
        errorCode: 'AUTH_CODE_REQUEST_THROTTLED',
        operation: 'http_exception',
        route: '/test',
        statusClass: '4xx',
        statusCode: 429,
      }),
      'http exception handled',
    );
    expect(recordException).toHaveBeenCalledWith({
      code: 'AUTH_CODE_REQUEST_THROTTLED',
      domain: 'platform',
      statusCode: 429,
    });
  });

  it('기본 Nest exception도 공통 shape로 정규화한다', () => {
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
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
    expect(write).toHaveBeenCalledWith(
      'info',
      expect.objectContaining({
        errorCode: 'BAD_REQUEST',
        operation: 'http_exception',
        route: '/test',
        statusClass: '4xx',
        statusCode: 400,
      }),
      'http exception handled',
    );
    expect(recordException).toHaveBeenCalledWith({
      code: 'BAD_REQUEST',
      domain: 'platform',
      statusCode: 400,
    });
  });

  it('Nest throttler exception은 framework 문구를 숨기고 retry-after를 body/header로 보존한다', () => {
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      getHeader: vi.fn((name: string) => (name === 'Retry-After' ? '42' : undefined)),
      setHeader: vi.fn(),
    };

    filter.catch(new ThrottlerException(), createHost(response));

    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', 42);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
        code: 'TOO_MANY_REQUESTS',
        statusCode: 429,
        path: '/api/test',
        retryAfterSeconds: 42,
      }),
    );
  });

  it('logger 실패가 error response 생성을 막지 않는다', () => {
    const throwingFilter = new ApiExceptionFilter(
      {
        write: vi.fn(() => {
          throw new Error('logger unavailable');
        }),
      } as unknown as AppLoggerService,
      { recordException: vi.fn() } as never,
    );
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    expect(() =>
      throwingFilter.catch(
        new BadRequestException('요청 값이 잘못되었습니다.'),
        createHost(response),
      ),
    ).not.toThrow();
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'BAD_REQUEST',
        statusCode: 400,
      }),
    );
  });
});

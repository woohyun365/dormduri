import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { HttpAdapterHost } from '@nestjs/core';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { serviceUnavailableError, tooManyRequestsError } from './api-error.js';
import type { AppLoggerService } from '../observability/logging/app-logger.service.js';

function createHost(
  response: { status: Mock; json: Mock },
  request: { originalUrl?: string } = {},
): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'GET',
        originalUrl: '/api/test',
        route: { path: '/test' },
        url: '/api/test',
        ...request,
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
  const adapter = {
    getHeader: vi.fn((response: { getHeader?: (name: string) => unknown }, name: string) =>
      response.getHeader?.(name),
    ),
    setHeader: vi.fn(
      (
        response: { setHeader?: (name: string, value: string) => unknown },
        name: string,
        value: string,
      ) => response.setHeader?.(name, value),
    ),
    reply: vi.fn((response: { status: Mock; json: Mock }, body: unknown, status: number) => {
      response.status(status);
      response.json(body);
    }),
  };
  const adapterHost = new HttpAdapterHost();
  adapterHost.httpAdapter = adapter as never;
  const filter = new ApiExceptionFilter(logger, metrics as never, adapterHost);

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
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '42');
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

  it('bounded capacity 503은 retry-after를 body/header로 보존한다', () => {
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
    };

    filter.catch(
      serviceUnavailableError(
        'AUTH_PASSWORD_HASH_CAPACITY_UNAVAILABLE',
        '비밀번호 처리가 잠시 지연되고 있어요.',
        { retryAfterSeconds: 2 },
      ),
      createHost(response),
    );

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '2');
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'AUTH_PASSWORD_HASH_CAPACITY_UNAVAILABLE',
        retryAfterSeconds: 2,
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
      adapterHost,
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

  it('resolves the adapter at catch time when the host is populated after construction', () => {
    const deferredHost = new HttpAdapterHost();
    const deferredFilter = new ApiExceptionFilter(logger, metrics as never, deferredHost);
    deferredHost.httpAdapter = adapter as never;
    const response = { status: vi.fn(), json: vi.fn() };
    deferredFilter.catch(new BadRequestException('bad'), createHost(response));
    expect(adapter.reply).toHaveBeenCalledExactlyOnceWith(
      response,
      expect.objectContaining({ statusCode: 400 }),
      400,
    );
  });

  it.each([undefined, ''])('preserves originalUrl ?? url for %s', (originalUrl) => {
    const response = { status: vi.fn(), json: vi.fn() };
    filter.catch(new BadRequestException('bad'), createHost(response, { originalUrl }));
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ path: originalUrl ?? '/api/test' }),
    );
  });

  it.each([undefined, 'text/plain', 'application/problem+json', 'Application/JSON'])(
    'replaces pre-set %s with JSON before adapter reply',
    (type) => {
      const response = { status: vi.fn(), json: vi.fn(), getHeader: vi.fn(() => type) };
      filter.catch(new BadRequestException('bad'), createHost(response));
      expect(adapter.setHeader).toHaveBeenCalledExactlyOnceWith(
        response,
        'Content-Type',
        'application/json',
      );
      expect(adapter.reply).toHaveBeenCalledExactlyOnceWith(
        response,
        expect.objectContaining({ code: 'BAD_REQUEST' }),
        400,
      );
      expect(adapter.setHeader.mock.invocationCallOrder[0]).toBeLessThan(
        adapter.reply.mock.invocationCallOrder[0]!,
      );
    },
  );

  it.each(['2.1', ['3.2', '99'], 4, 'invalid', 0, -1, Infinity])(
    'keeps header Retry-After coercion for %j',
    (header) => {
      const response = {
        status: vi.fn(),
        json: vi.fn(),
        getHeader: vi.fn(() => header),
        setHeader: vi.fn(),
      };
      filter.catch(new ThrottlerException(), createHost(response));
      const raw = Array.isArray(header) ? header[0] : header;
      const expected =
        Number.isFinite(Number(raw)) && Number(raw) > 0 ? Math.ceil(Number(raw)) : undefined;
      if (expected === undefined) {
        expect(response.setHeader).not.toHaveBeenCalledWith('Retry-After', expect.anything());
        expect(response.json.mock.calls[0]?.[0]).not.toHaveProperty('retryAfterSeconds');
      } else {
        expect(response.setHeader).toHaveBeenCalledWith('Retry-After', String(expected));
        expect(response.json).toHaveBeenCalledWith(
          expect.objectContaining({ retryAfterSeconds: expected }),
        );
      }
    },
  );

  it('does not silently suppress the existing response writer error after headers are sent', () => {
    const failure = new Error('headers already sent');
    const response = {
      headersSent: true,
      status: vi.fn(),
      json: vi.fn(() => {
        throw failure;
      }),
    };
    expect(() => filter.catch(new BadRequestException('bad'), createHost(response))).toThrow(
      failure,
    );
    expect(write).toHaveBeenCalledTimes(1);
    expect(recordException).toHaveBeenCalledTimes(1);
  });
});

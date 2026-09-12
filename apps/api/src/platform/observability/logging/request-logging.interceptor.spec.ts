import { describe, expect, it, vi } from 'vitest';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { of } from 'rxjs';
import { RequestLoggingInterceptor } from './request-logging.interceptor.js';
import type { AppLoggerService } from './app-logger.service.js';

function makeExecutionContext(request: Request, response: Response): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as ExecutionContext;
}

function makeResponse(statusCode = 200) {
  const response = Object.assign(new EventEmitter(), { statusCode }) as unknown as Response;
  const once = vi.spyOn(response, 'once');

  return {
    emitFinish: () => response.emit('finish'),
    emitClose: () => response.emit('close'),
    response,
    once,
  };
}

describe('RequestLoggingInterceptor', () => {
  it('records safe request completion metadata without body/header/cookie values', () => {
    const write = vi.fn();
    const interceptor = new RequestLoggingInterceptor({ write } as unknown as AppLoggerService);
    const { emitFinish, response, once } = makeResponse(201);
    const request = {
      body: { password: 'secret' },
      cookies: { accessToken: 'token' },
      headers: { authorization: 'Bearer token' },
      method: 'POST',
      route: { path: '/auth/login' },
    } as unknown as Request;

    interceptor
      .intercept(makeExecutionContext(request, response), { handle: () => of('ok') } as CallHandler)
      .subscribe();
    expect(once).toHaveBeenCalledExactlyOnceWith('finish', expect.any(Function));
    expect(write).not.toHaveBeenCalled();
    emitFinish();

    expect(write).toHaveBeenCalledWith(
      'info',
      expect.objectContaining({
        method: 'POST',
        operation: 'http_request',
        outcome: 'success',
        route: '/auth/login',
        statusClass: '2xx',
        statusCode: 201,
      }),
      'http request completed',
    );
    expect(JSON.stringify(write.mock.calls[0])).not.toContain('secret');
    expect(JSON.stringify(write.mock.calls[0])).not.toContain('Bearer token');
  });

  it('does not let logger failure affect request stream', () => {
    const interceptor = new RequestLoggingInterceptor({
      write: vi.fn(() => {
        throw new Error('logger unavailable');
      }),
    } as unknown as AppLoggerService);
    const { emitFinish, response } = makeResponse(500);
    const request = {
      method: 'GET',
      route: { path: '/health' },
    } as unknown as Request;

    expect(() => {
      interceptor
        .intercept(makeExecutionContext(request, response), {
          handle: () => of('ok'),
        } as CallHandler)
        .subscribe();
      emitFinish();
    }).not.toThrow();
  });

  it('does not log completion for a response that only closes', () => {
    const write = vi.fn();
    const interceptor = new RequestLoggingInterceptor({ write } as unknown as AppLoggerService);
    const { emitClose, response, once } = makeResponse();
    const request = { method: 'GET', route: { path: '/test' } } as unknown as Request;

    interceptor
      .intercept(makeExecutionContext(request, response), { handle: () => of('ok') } as CallHandler)
      .subscribe();
    expect(write).not.toHaveBeenCalled();
    emitClose();

    expect(once).toHaveBeenCalledExactlyOnceWith('finish', expect.any(Function));
    expect(write).not.toHaveBeenCalled();
  });
});

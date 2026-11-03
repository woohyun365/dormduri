import { describe, expect, it, vi } from 'vitest';
import { SetMetadata, type CallHandler, type ExecutionContext } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import { EventEmitter } from 'node:events';
import type { ServerResponse } from 'node:http';
import { of } from 'rxjs';
import { RequestLoggingInterceptor } from './request-logging.interceptor.js';
import type { AppLoggerService } from './app-logger.service.js';

type ProbeResponse = Pick<ServerResponse, 'once' | 'statusCode'> & EventEmitter;

class RouteProbeController {}

// The interceptor reads the route template from the handler's Nest path metadata.
function makeExecutionContext(
  request: object,
  response: ProbeResponse,
  routePath: string,
): ExecutionContext {
  const handler = () => undefined;
  SetMetadata(PATH_METADATA, routePath)(handler);
  return {
    getClass: () => RouteProbeController,
    getHandler: () => handler,
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

function makeInterceptor(logger: Pick<AppLoggerService, 'write'>) {
  return new RequestLoggingInterceptor(logger as AppLoggerService, new Reflector());
}

function makeResponse(statusCode = 200) {
  const response = Object.assign(new EventEmitter(), { statusCode }) as unknown as ProbeResponse;
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
    const interceptor = makeInterceptor({ write });
    const { emitFinish, response, once } = makeResponse(201);
    const request = {
      body: { password: 'secret' },
      cookies: { accessToken: 'token' },
      headers: { authorization: 'Bearer token' },
      method: 'POST',
    };

    interceptor
      .intercept(makeExecutionContext(request, response, '/auth/login'), {
        handle: () => of('ok'),
      } as CallHandler)
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
    const interceptor = makeInterceptor({
      write: vi.fn(() => {
        throw new Error('logger unavailable');
      }),
    });
    const { emitFinish, response } = makeResponse(500);
    const request = { method: 'GET' };

    expect(() => {
      interceptor
        .intercept(makeExecutionContext(request, response, '/health'), {
          handle: () => of('ok'),
        } as CallHandler)
        .subscribe();
      emitFinish();
    }).not.toThrow();
  });

  it('does not log completion for a response that only closes', () => {
    const write = vi.fn();
    const interceptor = makeInterceptor({ write });
    const { emitClose, response, once } = makeResponse();
    const request = { method: 'GET' };

    interceptor
      .intercept(makeExecutionContext(request, response, '/test'), {
        handle: () => of('ok'),
      } as CallHandler)
      .subscribe();
    expect(write).not.toHaveBeenCalled();
    emitClose();

    expect(once).toHaveBeenCalledExactlyOnceWith('finish', expect.any(Function));
    expect(write).not.toHaveBeenCalled();
  });
});

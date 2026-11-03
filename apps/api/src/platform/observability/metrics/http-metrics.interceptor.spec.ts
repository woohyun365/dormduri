import { describe, expect, it, vi } from 'vitest';
import { SetMetadata, type CallHandler, type ExecutionContext } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import { EventEmitter } from 'node:events';
import type { ServerResponse } from 'node:http';
import { of } from 'rxjs';
import { HttpMetricsInterceptor } from './http-metrics.interceptor.js';
import type { HttpMetricsService } from './http-metrics.service.js';

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

function makeInterceptor(metrics: HttpMetricsService) {
  return new HttpMetricsInterceptor(metrics, new Reflector());
}

function makeResponse(statusCode = 200) {
  const response = Object.assign(new EventEmitter(), { statusCode }) as unknown as ProbeResponse;

  return {
    emit: (event: string) => response.emit(event),
    response,
  };
}

describe('HttpMetricsInterceptor', () => {
  it.each([
    ['finish', 'close'],
    ['close', 'finish'],
  ])(
    'records route-template metrics and decrements in-flight once for %s then %s',
    (first, second) => {
      const finishInFlight = vi.fn();
      const recordRequest = vi.fn();
      const startRequest = vi.fn(() => finishInFlight);
      const metrics = {
        recordRequest,
        startRequest,
      } as unknown as HttpMetricsService;
      const interceptor = makeInterceptor(metrics);
      const { emit, response } = makeResponse(404);
      const request = { method: 'GET' };

      interceptor
        .intercept(makeExecutionContext(request, response, '/profiles/:id'), {
          handle: () => of('ok'),
        } as CallHandler)
        .subscribe();
      emit(first);
      emit(second);

      expect(startRequest).toHaveBeenCalledWith('/profiles/:id');
      expect(recordRequest).toHaveBeenCalledTimes(1);
      expect(recordRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          route: '/profiles/:id',
          statusCode: 404,
        }),
      );
      expect(finishInFlight).toHaveBeenCalledTimes(1);
    },
  );

  it('does not let metrics failures affect request stream', () => {
    const metrics = {
      recordRequest: vi.fn(() => {
        throw new Error('metrics unavailable');
      }),
      startRequest: vi.fn(() => {
        throw new Error('metrics unavailable');
      }),
    } as unknown as HttpMetricsService;
    const interceptor = makeInterceptor(metrics);
    const { emit, response } = makeResponse(500);
    const request = { method: 'POST' };

    expect(() => {
      interceptor
        .intercept(makeExecutionContext(request, response, '/reports'), {
          handle: () => of('ok'),
        } as CallHandler)
        .subscribe();
      emit('finish');
    }).not.toThrow();
  });

  it.each([false, true])(
    'finalizes a close-only response once even when recording fails=%s',
    (recordingFails) => {
      const finishInFlight = vi.fn();
      const recordRequest = vi.fn(() => {
        if (recordingFails) throw new Error('metrics unavailable');
      });
      const startRequest = vi.fn(() => finishInFlight);
      const interceptor = makeInterceptor({
        startRequest,
        recordRequest,
      } as unknown as HttpMetricsService);
      const { emit, response } = makeResponse();
      const request = { method: 'GET' };

      interceptor
        .intercept(makeExecutionContext(request, response, '/test'), {
          handle: () => of('ok'),
        } as CallHandler)
        .subscribe();
      expect(startRequest).toHaveBeenCalledExactlyOnceWith('/test');
      expect(recordRequest).not.toHaveBeenCalled();
      expect(finishInFlight).not.toHaveBeenCalled();

      expect(() => emit('close')).not.toThrow();
      expect(recordRequest).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ method: 'GET', route: '/test', statusCode: 200 }),
      );
      expect(finishInFlight).toHaveBeenCalledTimes(1);
      emit('close');
      emit('finish');
      expect(recordRequest).toHaveBeenCalledTimes(1);
      expect(finishInFlight).toHaveBeenCalledTimes(1);
    },
  );
});

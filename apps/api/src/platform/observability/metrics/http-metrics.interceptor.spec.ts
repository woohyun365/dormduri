import { describe, expect, it, vi } from 'vitest';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { of } from 'rxjs';
import { HttpMetricsInterceptor } from './http-metrics.interceptor.js';
import type { HttpMetricsService } from './http-metrics.service.js';

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
      const interceptor = new HttpMetricsInterceptor(metrics);
      const { emit, response } = makeResponse(404);
      const request = {
        method: 'GET',
        route: { path: '/profiles/:id' },
      } as unknown as Request;

      interceptor
        .intercept(makeExecutionContext(request, response), {
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
    const interceptor = new HttpMetricsInterceptor(metrics);
    const { emit, response } = makeResponse(500);
    const request = {
      method: 'POST',
      route: { path: '/reports' },
    } as unknown as Request;

    expect(() => {
      interceptor
        .intercept(makeExecutionContext(request, response), {
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
      const interceptor = new HttpMetricsInterceptor({
        startRequest,
        recordRequest,
      } as unknown as HttpMetricsService);
      const { emit, response } = makeResponse();
      const request = { method: 'GET', route: { path: '/test' } } as unknown as Request;

      interceptor
        .intercept(makeExecutionContext(request, response), {
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

import { describe, expect, it, vi } from 'vitest';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
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
  const handlers = new Map<string, () => void>();
  const response = {
    statusCode,
    once: vi.fn((event: string, handler: () => void) => {
      handlers.set(event, handler);
      return response;
    }),
  } as unknown as Response;

  return {
    emit: (event: string) => handlers.get(event)?.(),
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
});

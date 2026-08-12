import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import type { ConfigType } from '@nestjs/config';
import observabilityConfig from '../observability.config.js';
import {
  CORRELATION_ID_HEADER,
  RequestContextMiddleware,
  REQUEST_ID_HEADER,
  resolveSafeCorrelationId,
} from './request-context.middleware.js';
import { RequestContextService } from './request-context.service.js';

function makeRequestContextService() {
  return new RequestContextService({
    env: 'test',
    logHashSecret: 'test-secret',
    logLevel: 'info',
    logPretty: false,
    metricsEnabled: true,
    metricsBearerToken: 'metrics-secret',
    metricsRoute: 'internal/metrics',
    metricsHttpDurationBuckets: [0.05, 0.1, 0.2],
    serviceName: 'api',
  } satisfies ConfigType<typeof observabilityConfig>);
}

describe('RequestContextMiddleware', () => {
  it('accepts safe inbound request/correlation ids and returns X-Request-Id', () => {
    const requestContext = makeRequestContextService();
    const middleware = new RequestContextMiddleware(requestContext);
    const setHeader = vi.fn();
    const next = vi.fn(() => {
      expect(requestContext.getStore()).toEqual({
        correlationId: 'corr-12345678',
        requestId: 'req-12345678',
      });
    });

    middleware.use(
      {
        headers: {
          [CORRELATION_ID_HEADER]: 'corr-12345678',
          [REQUEST_ID_HEADER]: 'req-12345678',
        },
      } as unknown as Request,
      { setHeader } as unknown as Response,
      next,
    );

    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', 'req-12345678');
    expect(next).toHaveBeenCalledOnce();
  });

  it('regenerates unsafe request id values', () => {
    const requestContext = makeRequestContextService();
    const middleware = new RequestContextMiddleware(requestContext);
    const setHeader = vi.fn();
    const next = vi.fn(() => {
      const store = requestContext.getStore();
      expect(store?.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(store?.correlationId).toBe(store?.requestId);
    });

    middleware.use(
      {
        headers: {
          [REQUEST_ID_HEADER]: 'unsafe raw email student@knu.ac.kr',
        },
      } as unknown as Request,
      { setHeader } as unknown as Response,
      next,
    );

    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', expect.any(String));
  });

  it('validates safe correlation id syntax without accepting raw path-like values', () => {
    expect(resolveSafeCorrelationId('request-1234')).toBe('request-1234');
    expect(resolveSafeCorrelationId('/api/users/1')).toBeNull();
    expect(resolveSafeCorrelationId('short')).toBeNull();
  });
});

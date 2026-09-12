import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Logger,
  type INestApplication,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type { ConfigType } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { HealthController } from '../../health/health.controller.js';
import { HealthService } from '../../health/health.service.js';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { serviceUnavailableError } from './api-error.js';
import { configureHttpRuntime } from './http-runtime.js';
import { MetricsController } from '../observability/metrics/metrics.controller.js';
import { PrometheusRegistryService } from '../observability/metrics/prometheus-registry.service.js';
import { HttpMetricsService } from '../observability/metrics/http-metrics.service.js';
import { HttpMetricsInterceptor } from '../observability/metrics/http-metrics.interceptor.js';
import { AppLoggerService } from '../observability/logging/app-logger.service.js';
import { RequestLoggingInterceptor } from '../observability/logging/request-logging.interceptor.js';
import { RequestContextMiddleware } from '../observability/logging/request-context.middleware.js';
import { RequestContextService } from '../observability/logging/request-context.service.js';
import observabilityConfig from '../observability/observability.config.js';

@Controller('boundary-probe')
class BoundaryProbeController {
  constructor(private readonly context: RequestContextService) {}

  @Get('json-error')
  jsonError() {
    throw new BadRequestException('invalid request');
  }

  @Get('retry')
  @Header('Retry-After', '2.2')
  retry() {
    throw new ThrottlerException();
  }

  @Get('capacity')
  @Header('Retry-After', '9')
  capacity() {
    throw serviceUnavailableError('CAPACITY_UNAVAILABLE', 'try later', { retryAfterSeconds: 1.1 });
  }

  @Get('problem')
  @Header('Content-Type', 'application/problem+json')
  problem() {
    throw new BadRequestException('invalid request');
  }

  @Get('context')
  async requestContext() {
    await new Promise<void>((resolve) => setImmediate(resolve));
    return this.context.getStore();
  }
}

describe('real Express response and observability boundary', () => {
  let app: INestApplication;
  let url: string;
  const settings: ConfigType<typeof observabilityConfig> = {
    env: 'test',
    logHashSecret: 'test-secret',
    logLevel: 'info' as const,
    logPretty: false,
    metricsEnabled: true,
    metricsBearerToken: 'metrics-secret',
    metricsRoute: 'internal/metrics',
    metricsHttpDurationBuckets: [0.05, 0.1, 0.2],
    serviceName: 'api',
  };
  const context = new RequestContextService(settings);
  const logger = { write: vi.fn(() => context.getStore()) };
  const adapterWarning = vi.fn();
  const finishInFlight = vi.fn();
  const metrics = {
    recordException: vi.fn(),
    recordRequest: vi.fn(),
    startRequest: vi.fn(() => finishInFlight),
  };
  const registry = {
    getContentType: vi.fn(() => 'text/plain; version=0.0.4; charset=utf-8'),
    metrics: vi.fn<() => Promise<string>>(),
  };
  const health = { getReadiness: vi.fn(), getLiveness: vi.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MetricsController, HealthController, BoundaryProbeController],
      providers: [
        { provide: observabilityConfig.KEY, useValue: settings },
        { provide: PrometheusRegistryService, useValue: registry },
        { provide: HealthService, useValue: health },
        { provide: RequestContextService, useValue: context },
        { provide: AppLoggerService, useValue: logger },
        { provide: HttpMetricsService, useValue: metrics },
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    configureHttpRuntime(app, { trustProxy: false, corsAllowedOrigins: [] });
    const middleware = new RequestContextMiddleware(context);
    app.use((req: Request, res: Response, next: NextFunction) => middleware.use(req, res, next));
    app.useGlobalInterceptors(
      new RequestLoggingInterceptor(logger as never),
      new HttpMetricsInterceptor(metrics as never),
    );
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });
  afterAll(async () => {
    if (app) await app.close();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    settings.metricsEnabled = true;
    registry.metrics.mockResolvedValue('# HELP api_http_requests_total test\n');
    registry.getContentType.mockReturnValue('text/plain; version=0.0.4; charset=utf-8');
    health.getReadiness.mockResolvedValue({ status: 'ok', failureCodes: [] });
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(adapterWarning);
  });

  function errorBody(response: request.Response) {
    const body = JSON.parse(response.text) as Record<string, unknown>;
    expect(body.timestamp).toEqual(expect.any(String));
    expect(new Date(body.timestamp as string).toISOString()).toBe(body.timestamp);
    delete body.timestamp;
    return body;
  }

  function expectCompletedError(status: number, code: string, path: string) {
    expect(logger.write).toHaveBeenCalledTimes(2);
    expect(logger.write).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      expect.objectContaining({ operation: 'http_exception', route: path, statusCode: status }),
      'http exception handled',
    );
    expect(logger.write).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.objectContaining({ operation: 'http_request', route: path, statusCode: status }),
      'http request completed',
    );
    expect(metrics.recordException).toHaveBeenCalledExactlyOnceWith({
      code,
      domain: 'platform',
      statusCode: status,
    });
    expect(metrics.startRequest).toHaveBeenCalledExactlyOnceWith(path);
    expect(metrics.recordRequest).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ route: path, statusCode: status }),
    );
    expect(finishInFlight).toHaveBeenCalledTimes(1);
    expect(adapterWarning).not.toHaveBeenCalled();
  }

  it('authorized metrics scrape preserves type, no-store and completion counts', async () => {
    const response = await request(url)
      .get('/internal/metrics')
      .auth('metrics-secret', { type: 'bearer' })
      .set('x-request-id', 'request-12345678');
    expect(response.status).toBe(200);
    expect(response.text).toBe('# HELP api_http_requests_total test\n');
    expect(response.headers['content-type']).toBe('text/plain; charset=utf-8; version=0.0.4');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-request-id']).toBe('request-12345678');
    expect(registry.metrics).toHaveBeenCalledTimes(1);
    expect(logger.write).toHaveBeenCalledTimes(1);
    expect(metrics.recordException).not.toHaveBeenCalled();
    expect(metrics.recordRequest).toHaveBeenCalledTimes(1);
    expect(finishInFlight).toHaveBeenCalledTimes(1);
    expect(adapterWarning).not.toHaveBeenCalled();
  });

  it.each([
    [
      new Error('registry unavailable'),
      500,
      'INTERNAL_SERVER_ERROR',
      '일시적인 서버 오류가 발생했습니다.',
      undefined,
    ],
    [
      serviceUnavailableError('METRICS_UNAVAILABLE', 'try later', { retryAfterSeconds: 2.2 }),
      503,
      'METRICS_UNAVAILABLE',
      'try later',
      3,
    ],
  ] as const)(
    'metrics rejection returns JSON while preserving status, body, IDs and counts: %s',
    async (error, status, code, message, retry) => {
      registry.metrics.mockRejectedValueOnce(error);
      const response = await request(url)
        .get('/internal/metrics?probe=1')
        .auth('metrics-secret', { type: 'bearer' })
        .set('x-request-id', 'request-12345678')
        .set('x-correlation-id', 'correlation-12345678');
      expect(response.status).toBe(status);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['x-request-id']).toBe('request-12345678');
      expect(response.headers['retry-after']).toBe(retry === undefined ? undefined : String(retry));
      expect(errorBody(response)).toEqual({
        success: false,
        error: message,
        code,
        statusCode: status,
        path: '/internal/metrics?probe=1',
        ...(retry === undefined ? {} : { retryAfterSeconds: retry }),
      });
      expectCompletedError(status, code, '/internal/metrics');
      expect(logger.write.mock.results.map(({ value }) => value as unknown)).toEqual([
        { requestId: 'request-12345678', correlationId: 'correlation-12345678' },
        { requestId: 'request-12345678', correlationId: 'correlation-12345678' },
      ]);
    },
  );

  it.each([
    [true, 401, 'UNAUTHORIZED'],
    [false, 404, 'NOT_FOUND'],
  ] as const)(
    'metrics enabled=%s rejects before collection/interceptors',
    async (enabled, status, code) => {
      settings.metricsEnabled = enabled;
      const response = await request(url).get('/internal/metrics');
      expect(response.status).toBe(status);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.headers['cache-control']).toBeUndefined();
      expect(errorBody(response)).toMatchObject({ code, statusCode: status });
      expect(registry.getContentType).not.toHaveBeenCalled();
      expect(registry.metrics).not.toHaveBeenCalled();
      expect(logger.write).toHaveBeenCalledTimes(1);
      expect(metrics.recordException).toHaveBeenCalledTimes(1);
      expect(metrics.startRequest).not.toHaveBeenCalled();
      expect(adapterWarning).not.toHaveBeenCalled();
    },
  );

  it('ordinary JSON errors preserve envelope and one exception/completion event each', async () => {
    const response = await request(url).get('/boundary-probe/json-error');
    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(errorBody(response)).toEqual({
      success: false,
      error: 'invalid request',
      code: 'BAD_REQUEST',
      statusCode: 400,
      path: '/boundary-probe/json-error',
    });
    expectCompletedError(400, 'BAD_REQUEST', '/boundary-probe/json-error');
  });

  it.each([
    ['retry', 429, 'TOO_MANY_REQUESTS', 3],
    ['capacity', 503, 'CAPACITY_UNAVAILABLE', 2],
  ] as const)(
    'preserves Retry-After rounding and extras precedence for %s',
    async (path, status, code, retry) => {
      const response = await request(url).get(`/boundary-probe/${path}`);
      expect(response.status).toBe(status);
      expect(response.headers['retry-after']).toBe(String(retry));
      expect(errorBody(response)).toMatchObject({ code, retryAfterSeconds: retry });
      expectCompletedError(status, code, `/boundary-probe/${path}`);
    },
  );

  it('replaces a pre-set problem+json header with the common JSON error type without warning', async () => {
    const response = await request(url).get('/boundary-probe/problem');
    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(errorBody(response)).toMatchObject({ code: 'BAD_REQUEST' });
    expectCompletedError(400, 'BAD_REQUEST', '/boundary-probe/problem');
  });

  it.each([undefined, '/unsafe/path'])(
    'missing/unsafe request ID %s gets UUID, correlation fallback and downstream ALS',
    async (id) => {
      const req = request(url)
        .get('/boundary-probe/context')
        .set('x-correlation-id', 'unsafe value');
      if (id) req.set('x-request-id', id);
      const response = await req;
      const generated = response.headers['x-request-id'] as string;
      expect(generated).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(response.body).toEqual({ requestId: generated, correlationId: generated });
      expect(logger.write.mock.results[0]?.value).toEqual(response.body);
      expect(context.getStore()).toBeUndefined();
    },
  );

  it('concurrent requests retain separate safe IDs across async controller and completion logging', async () => {
    const ids = ['request-11111111', 'request-22222222'];
    const responses = await Promise.all(
      ids.map((id) => request(url).get('/boundary-probe/context').set('x-request-id', id)),
    );
    responses.forEach((response, index) => {
      expect(response.body).toEqual({ requestId: ids[index], correlationId: ids[index] });
      expect(response.headers['x-request-id']).toBe(ids[index]);
    });
    expect(logger.write.mock.results.map(({ value }) => value as unknown)).toEqual(
      expect.arrayContaining(responses.map(({ body }) => body as unknown)),
    );
  });

  it.each([
    ['ok', 200, []],
    ['unavailable', 503, ['DATABASE_UNAVAILABLE']],
  ] as const)(
    'health readiness %s preserves body and status',
    async (status, httpStatus, failureCodes) => {
      health.getReadiness.mockResolvedValueOnce({ status, failureCodes });
      const response = await request(url).get('/health/ready');
      expect(response.status).toBe(httpStatus);
      expect(response.body).toEqual({ status, failureCodes });
      expect(metrics.recordException).not.toHaveBeenCalled();
    },
  );

  it('logger/exception metric failures do not prevent the original error response', async () => {
    logger.write.mockImplementationOnce(() => {
      throw new Error('logger unavailable');
    });
    metrics.recordException.mockImplementationOnce(() => {
      throw new Error('metrics unavailable');
    });
    const response = await request(url).get('/boundary-probe/json-error');
    expect(response.status).toBe(400);
    expect(errorBody(response)).toMatchObject({ code: 'BAD_REQUEST' });
    expect(metrics.recordRequest).toHaveBeenCalledTimes(1);
    expect(finishInFlight).toHaveBeenCalledTimes(1);
  });
});

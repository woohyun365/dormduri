import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Logger,
  Post,
  Query,
  type INestApplication,
} from '@nestjs/common';
import { APP_FILTER, APP_GUARD, Reflector } from '@nestjs/core';
import type { ConfigType } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerException } from '@nestjs/throttler';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { gzipSync } from 'node:zlib';
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
import { RequestRouteTemplateGuard } from '../observability/logging/request-route-template.guard.js';
import observabilityConfig from '../observability/observability.config.js';
import { createHttpAdapter } from './http-adapter.js';

// The exception filter sets the type itself; NodeAdapter does not append a charset (JSON is UTF-8).
const ERROR_CONTENT_TYPE = 'application/json';
const ALLOWED_ORIGIN = 'https://app.example.com';

@Controller('boundary-probe')
class BoundaryProbeController {
  constructor(private readonly context: RequestContextService) {}

  @Get('ok')
  ok() {
    return { ok: true };
  }

  @Get('query')
  query(@Query() query: unknown) {
    return { query };
  }

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

  @Post('echo')
  echo(@Body() body: unknown) {
    return { body, polluted: ({} as Record<string, unknown>).polluted ?? null };
  }

  @Get('context')
  async requestContext() {
    await new Promise<void>((resolve) => setImmediate(resolve));
    return this.context.getStore();
  }
}

describe('real HTTP adapter response and observability boundary', () => {
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
        { provide: APP_GUARD, useClass: RequestRouteTemplateGuard },
      ],
    }).compile();
    app = module.createNestApplication(createHttpAdapter(false), { logger: false });
    configureHttpRuntime(app, { trustProxy: false, corsAllowedOrigins: [ALLOWED_ORIGIN] });
    const middleware = new RequestContextMiddleware(context);
    app.use((req: IncomingMessage, res: ServerResponse, next: () => void) =>
      middleware.use(req, res, next),
    );
    const reflector = module.get(Reflector);
    app.useGlobalInterceptors(
      new RequestLoggingInterceptor(logger as never, reflector),
      new HttpMetricsInterceptor(metrics as never, reflector),
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
    // The scrape sets the registry's own type, so the adapter neither adds nor reorders a charset.
    expect(response.headers['content-type']).toBe('text/plain; version=0.0.4; charset=utf-8');
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
      expect(response.headers['content-type']).toBe(ERROR_CONTENT_TYPE);
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
      expect(response.headers['content-type']).toBe(ERROR_CONTENT_TYPE);
      expect(response.headers['cache-control']).toBeUndefined();
      expect(errorBody(response)).toMatchObject({ code, statusCode: status });
      expect(registry.getContentType).not.toHaveBeenCalled();
      expect(registry.metrics).not.toHaveBeenCalled();
      expect(logger.write).toHaveBeenCalledExactlyOnceWith(
        expect.any(String),
        expect.objectContaining({
          operation: 'http_exception',
          route: '/internal/metrics',
          statusCode: status,
        }),
        'http exception handled',
      );
      expect(metrics.recordException).toHaveBeenCalledTimes(1);
      expect(metrics.startRequest).not.toHaveBeenCalled();
      expect(adapterWarning).not.toHaveBeenCalled();
    },
  );

  it('ordinary JSON errors preserve envelope and one exception/completion event each', async () => {
    const response = await request(url).get('/boundary-probe/json-error');
    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toBe(ERROR_CONTENT_TYPE);
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
    expect(response.headers['content-type']).toBe(ERROR_CONTENT_TYPE);
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

  function postEcho(type: string, body: string) {
    return request(url).post('/boundary-probe/echo').set('content-type', type).send(body);
  }

  // Compatibility check for the '@nestjs/platform-node>qs' workspace override: the adapter's
  // urlencoded parser calls qs.parse for nested keys and arrays.
  it('parses JSON and nested urlencoded bodies', async () => {
    const json = await postEcho('application/json', '{"a":{"b":1},"c":[2,3]}');
    expect(json.status).toBe(201);
    expect(json.body).toEqual({ body: { a: { b: 1 }, c: [2, 3] }, polluted: null });

    const form = await postEcho('application/x-www-form-urlencoded', 'a[b]=1&c=2&c=3');
    expect(form.status).toBe(201);
    expect(form.body).toEqual({ body: { a: { b: '1' }, c: ['2', '3'] }, polluted: null });
  });

  it.each([
    ['malformed JSON', 'application/json', '{"a":', 400, 'BAD_REQUEST'],
    [
      'oversized JSON',
      'application/json',
      JSON.stringify({ a: 'x'.repeat(110 * 1024) }),
      413,
      'HTTP_413',
    ],
    ['JSON __proto__ key', 'application/json', '{"__proto__":{"polluted":1}}', 400, 'BAD_REQUEST'],
    [
      'JSON constructor.prototype key',
      'application/json',
      '{"constructor":{"prototype":{"polluted":1}}}',
      400,
      'BAD_REQUEST',
    ],
    [
      'urlencoded __proto__ key',
      'application/x-www-form-urlencoded',
      '__proto__[polluted]=1',
      400,
      'BAD_REQUEST',
    ],
    [
      'urlencoded constructor.prototype key',
      'application/x-www-form-urlencoded',
      'constructor[prototype][polluted]=1',
      400,
      'BAD_REQUEST',
    ],
  ] as const)(
    'answers a rejected %s body with the common error envelope',
    async (_name, type, body, status, code) => {
      const response = await postEcho(type, body);
      expect(response.status).toBe(status);
      expect(response.headers['content-type']).toBe(ERROR_CONTENT_TYPE);
      expect(errorBody(response)).toMatchObject({
        success: false,
        code,
        statusCode: status,
        path: '/boundary-probe/echo',
      });
      expect(metrics.recordException).toHaveBeenCalledExactlyOnceWith({
        code,
        domain: 'platform',
        statusCode: status,
      });
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    },
  );

  // body-parser below 2.4.0 crashed the process here (GHSA-27r3-jxmh-p828); the adapter's own
  // parser must answer and keep serving now that body-parser left the dependency graph.
  it('keeps serving after a compressed body with trailing bytes', async () => {
    const body = Buffer.concat([gzipSync('{"a":1}'), Buffer.from('trailing bytes')]);
    const response = await request(url)
      .post('/boundary-probe/echo')
      .set('content-type', 'application/json')
      .set('content-encoding', 'gzip')
      .send(body);
    expect([201, 400]).toContain(response.status);
    await new Promise<void>((resolve) => setImmediate(resolve));

    const next = await postEcho('application/json', '{"after":true}');
    expect(next.status).toBe(201);
    expect(next.body).toEqual({ body: { after: true }, polluted: null });
  });

  it('matches paths case-sensitively and answers another case with the 404 envelope', async () => {
    const response = await request(url).get('/BOUNDARY-PROBE/json-error');
    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toBe(ERROR_CONTENT_TYPE);
    expect(errorBody(response)).toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
      path: '/BOUNDARY-PROBE/json-error',
    });
    expect(logger.write).toHaveBeenCalledExactlyOnceWith(
      expect.any(String),
      expect.objectContaining({ operation: 'http_exception', route: 'UNKNOWN_ROUTE' }),
      'http exception handled',
    );
  });
  function expectSecurityHeaders(response: request.Response) {
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['strict-transport-security']).toBe(
      'max-age=31536000; includeSubDomains',
    );
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['x-powered-by']).toBeUndefined();
  }

  it.each([
    ['a success', () => request(url).get('/boundary-probe/ok'), 200],
    ['an unknown route', () => request(url).get('/boundary-probe/missing'), 404],
    ['a malformed JSON body', () => postEcho('application/json', '{"a":'), 400],
    ['a malformed percent-encoded path', () => request(url).get('/boundary-probe/%FF'), 400],
  ] as const)('sends the Helmet headers on %s response', async (_name, send, status) => {
    const response = await send();
    expect(response.status).toBe(status);
    expectSecurityHeaders(response);
  });

  it('answers REST CORS for the allowlisted origin only', async () => {
    const preflight = await request(url)
      .options('/boundary-probe/ok')
      .set('origin', ALLOWED_ORIGIN)
      .set('access-control-request-method', 'GET')
      .set('access-control-request-headers', 'authorization,x-request-id');
    expect(preflight.status).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(preflight.headers['access-control-allow-methods']).toBe(
      'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS',
    );
    expect(preflight.headers['access-control-allow-headers']).toBe(
      'Authorization,Content-Type,X-Request-Id',
    );
    expect(preflight.headers['access-control-allow-credentials']).toBeUndefined();
    expectSecurityHeaders(preflight);

    const allowed = await request(url).get('/boundary-probe/ok').set('origin', ALLOWED_ORIGIN);
    expect(allowed.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(allowed.headers['access-control-expose-headers']).toBe('X-Request-Id');

    const otherOrigin = await request(url)
      .get('/boundary-probe/ok')
      .set('origin', 'https://other.example.com');
    expect(otherOrigin.status).toBe(200);
    expect(otherOrigin.headers['access-control-allow-origin']).toBeUndefined();

    const otherPreflight = await request(url)
      .options('/boundary-probe/ok')
      .set('origin', 'https://other.example.com')
      .set('access-control-request-method', 'GET');
    expect(otherPreflight.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers a malformed percent-encoded path before the CORS and request-context middleware', async () => {
    const response = await request(url)
      .get('/boundary-probe/%FF')
      .set('origin', ALLOWED_ORIGIN)
      .set('x-request-id', 'request-12345678');
    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toBe(ERROR_CONTENT_TYPE);
    expect(errorBody(response)).toMatchObject({
      success: false,
      error: 'URI malformed',
      code: 'BAD_REQUEST',
      statusCode: 400,
      path: '/boundary-probe/%FF',
    });
    // Helmet runs through the adapter security hook; CORS and request IDs are middleware.
    expectSecurityHeaders(response);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['x-request-id']).toBeUndefined();
    expect(logger.write).toHaveBeenCalledExactlyOnceWith(
      expect.any(String),
      expect.objectContaining({ operation: 'http_exception', route: 'UNKNOWN_ROUTE' }),
      'http exception handled',
    );
  });

  it('sends no ETag, so a conditional request gets the full 200 response', async () => {
    const first = await request(url).get('/boundary-probe/ok');
    expect(first.status).toBe(200);
    expect(first.headers.etag).toBeUndefined();

    // The earlier Express adapter answered 304 here.
    const conditional = await request(url).get('/boundary-probe/ok').set('if-none-match', '*');
    expect(conditional.status).toBe(200);
    expect(conditional.body).toEqual({ ok: true });
  });

  it('parses query strings into flat bracket keys and repeated-key arrays', async () => {
    const response = await request(url).get('/boundary-probe/query?a[b]=1&c=2&c=3&d=x+y&e=%2F');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ query: { 'a[b]': '1', c: ['2', '3'], d: 'x y', e: '/' } });
  });
});

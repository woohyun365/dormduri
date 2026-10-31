import type { INestApplication } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  buildHttpCorsOptions,
  configureHttpRuntime,
  type HttpRuntimeSettings,
} from './http-runtime.js';

function makeHttpSettings(overrides: Partial<HttpRuntimeSettings> = {}): HttpRuntimeSettings {
  return {
    trustProxy: false,
    corsAllowedOrigins: [],
    ...overrides,
  };
}

function makeAppMock() {
  const getHttpAdapter = vi.fn();
  const appUse = vi.fn();
  const enableCors = vi.fn();
  const app = {
    getHttpAdapter,
    use: appUse,
    enableCors,
  } as unknown as INestApplication & {
    getHttpAdapter: ReturnType<typeof vi.fn>;
    use: ReturnType<typeof vi.fn>;
    enableCors: ReturnType<typeof vi.fn>;
  };

  return { app, getHttpAdapter, appUse, enableCors };
}

describe('buildHttpCorsOptions', () => {
  it('keeps CORS disabled when no explicit origins are configured', () => {
    expect(buildHttpCorsOptions([])).toBeNull();
  });

  it('builds explicit non-cookie CORS options for REST API origins', () => {
    expect(buildHttpCorsOptions(['https://app.example.com'])).toEqual({
      origin: ['https://app.example.com'],
      credentials: false,
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
      optionsSuccessStatus: 204,
    });
  });
});

describe('configureHttpRuntime', () => {
  it('registers helmet then explicit non-cookie CORS without a cookie parser or adapter settings', () => {
    const { app, getHttpAdapter, appUse, enableCors } = makeAppMock();

    configureHttpRuntime(
      app,
      makeHttpSettings({ trustProxy: 2, corsAllowedOrigins: ['https://app.example.com'] }),
    );

    // Trust proxy is fixed when the adapter is created (http-adapter.ts), not set here.
    expect(getHttpAdapter).not.toHaveBeenCalled();
    expect(appUse).toHaveBeenCalledTimes(1);
    expect(appUse.mock.invocationCallOrder[0]).toBeLessThan(
      enableCors.mock.invocationCallOrder[0]!,
    );
    expect(enableCors).toHaveBeenCalledWith(
      expect.objectContaining({ origin: ['https://app.example.com'], credentials: false }),
    );
  });

  it('does not enable permissive wildcard CORS when origins are absent', () => {
    const { app, appUse, enableCors } = makeAppMock();

    configureHttpRuntime(app, makeHttpSettings());

    expect(appUse).toHaveBeenCalledTimes(1);
    expect(enableCors).not.toHaveBeenCalled();
  });
});

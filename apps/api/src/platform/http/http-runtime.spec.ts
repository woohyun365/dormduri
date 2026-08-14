import type { INestApplication } from '@nestjs/common';
import type { Express } from 'express';
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
    cookieSecure: false,
    cookieSameSite: 'lax',
    cookieDomain: null,
    ...overrides,
  };
}

function makeAppMock() {
  const expressApp = { set: vi.fn() } as unknown as Express;
  const app = {
    getHttpAdapter: vi.fn(() => ({ getInstance: vi.fn(() => expressApp) })),
    use: vi.fn(),
    enableCors: vi.fn(),
  } as unknown as INestApplication & {
    getHttpAdapter: ReturnType<typeof vi.fn>;
    use: ReturnType<typeof vi.fn>;
    enableCors: ReturnType<typeof vi.fn>;
  };

  return { app, expressApp: expressApp as Express & { set: ReturnType<typeof vi.fn> } };
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
  it('registers trust proxy, helmet, cookie parser, and explicit CORS', () => {
    const { app, expressApp } = makeAppMock();

    configureHttpRuntime(
      app,
      makeHttpSettings({ trustProxy: 2, corsAllowedOrigins: ['https://app.example.com'] }),
    );

    expect(expressApp.set).toHaveBeenCalledWith('trust proxy', 2);
    expect(app.use).toHaveBeenCalledTimes(2);
    expect(app.enableCors).toHaveBeenCalledWith(
      expect.objectContaining({ origin: ['https://app.example.com'], credentials: false }),
    );
  });

  it('does not enable permissive wildcard CORS when origins are absent', () => {
    const { app, expressApp } = makeAppMock();

    configureHttpRuntime(app, makeHttpSettings());

    expect(expressApp.set).toHaveBeenCalledWith('trust proxy', false);
    expect(app.enableCors).not.toHaveBeenCalled();
  });
});

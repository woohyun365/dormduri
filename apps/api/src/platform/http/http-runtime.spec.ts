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
  const expressSet = vi.fn();
  const appUse = vi.fn();
  const enableCors = vi.fn();
  const expressApp = { set: expressSet } as unknown as Express;
  const app = {
    getHttpAdapter: vi.fn(() => ({ getInstance: vi.fn(() => expressApp) })),
    use: appUse,
    enableCors,
  } as unknown as INestApplication & {
    getHttpAdapter: ReturnType<typeof vi.fn>;
    use: ReturnType<typeof vi.fn>;
    enableCors: ReturnType<typeof vi.fn>;
  };

  return { app, expressSet, appUse, enableCors };
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
    const { app, expressSet, appUse, enableCors } = makeAppMock();

    configureHttpRuntime(
      app,
      makeHttpSettings({ trustProxy: 2, corsAllowedOrigins: ['https://app.example.com'] }),
    );

    expect(expressSet).toHaveBeenCalledWith('trust proxy', 2);
    expect(appUse).toHaveBeenCalledTimes(2);
    expect(enableCors).toHaveBeenCalledWith(
      expect.objectContaining({ origin: ['https://app.example.com'], credentials: false }),
    );
  });

  it('does not enable permissive wildcard CORS when origins are absent', () => {
    const { app, expressSet, enableCors } = makeAppMock();

    configureHttpRuntime(app, makeHttpSettings());

    expect(expressSet).toHaveBeenCalledWith('trust proxy', false);
    expect(enableCors).not.toHaveBeenCalled();
  });
});

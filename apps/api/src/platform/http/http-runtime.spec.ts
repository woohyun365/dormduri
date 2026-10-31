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

type SecurityHook = (
  request: unknown,
  response: {
    setHeader(name: string, value: string): unknown;
    removeHeader(name: string): unknown;
  },
) => Error | undefined;

function makeAppMock({ securityHook = true }: { securityHook?: boolean } = {}) {
  const registerSecurityHook = vi.fn<(hook: SecurityHook) => void>();
  const getHttpAdapter = vi.fn(() => (securityHook ? { registerSecurityHook } : {}));
  const appUse = vi.fn();
  const enableCors = vi.fn();
  const app = {
    getHttpAdapter,
    use: appUse,
    enableCors,
  } as unknown as INestApplication;

  return { app, registerSecurityHook, appUse, enableCors };
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
  it('registers helmet as the adapter security hook, then explicit non-cookie CORS', () => {
    const { app, registerSecurityHook, appUse, enableCors } = makeAppMock();

    configureHttpRuntime(
      app,
      makeHttpSettings({ trustProxy: 2, corsAllowedOrigins: ['https://app.example.com'] }),
    );

    // Trust proxy is fixed when the adapter is created (http-adapter.ts), not set here.
    expect(registerSecurityHook).toHaveBeenCalledTimes(1);
    expect(appUse).not.toHaveBeenCalled();
    expect(registerSecurityHook.mock.invocationCallOrder[0]).toBeLessThan(
      enableCors.mock.invocationCallOrder[0]!,
    );
    expect(enableCors).toHaveBeenCalledWith(
      expect.objectContaining({ origin: ['https://app.example.com'], credentials: false }),
    );
  });

  it('writes the helmet headers synchronously and lets the request continue', () => {
    const { app, registerSecurityHook } = makeAppMock();
    configureHttpRuntime(app, makeHttpSettings());
    const hook = registerSecurityHook.mock.calls[0]![0];
    const response = { setHeader: vi.fn(), removeHeader: vi.fn() };

    expect(hook({ headers: {} }, response)).toBeUndefined();
    expect(response.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.stringContaining("default-src 'self'"),
    );
    expect(response.removeHeader).toHaveBeenCalledWith('X-Powered-By');
  });

  it('fails startup when the adapter has no security hook for the headers', () => {
    const { app } = makeAppMock({ securityHook: false });

    expect(() => configureHttpRuntime(app, makeHttpSettings())).toThrow(
      'The HTTP adapter cannot run the security headers before routing.',
    );
  });

  it('does not enable permissive wildcard CORS when origins are absent', () => {
    const { app, registerSecurityHook, enableCors } = makeAppMock();

    configureHttpRuntime(app, makeHttpSettings());

    expect(registerSecurityHook).toHaveBeenCalledTimes(1);
    expect(enableCors).not.toHaveBeenCalled();
  });
});

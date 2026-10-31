import type { INestApplication } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import helmet from 'helmet';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type httpConfig from './http.config.js';

export type HttpRuntimeSettings = ConfigType<typeof httpConfig>;

export interface HttpCorsOptions {
  readonly origin: string[];
  readonly credentials: false;
  readonly methods: string[];
  readonly allowedHeaders: string[];
  readonly exposedHeaders: string[];
  readonly optionsSuccessStatus: 204;
}

export function configureHttpRuntime(
  app: INestApplication,
  httpSettings: HttpRuntimeSettings,
): void {
  // Trust proxy is a NodeAdapter constructor option (see http-adapter.ts), not a runtime setting.
  registerSecurityHeaders(app);

  const corsOptions = buildHttpCorsOptions(httpSettings.corsAllowedOrigins);
  if (corsOptions !== null) {
    app.enableCors(corsOptions);
  }
}

// Same shape as Nest's SecurityRequestHook, which @nestjs/common does not export from its root.
// The response is the Node ServerResponse; the hook may only set and remove headers on it.
type SecurityHeaderHook = (
  request: IncomingMessage,
  response: {
    setHeader(name: string, value: string): unknown;
    removeHeader(name: string): unknown;
  },
) => Error | undefined;

/**
 * Runs Helmet through the adapter's security hook instead of app.use(). The hook takes the place
 * in the middleware chain app.use() would give it, and NodeAdapter also runs it for a request its
 * router rejects before any middleware (a malformed percent-encoded URL, answered with 400), so
 * that response keeps the security headers the earlier Express adapter sent. Helmet's middleware
 * is synchronous and only sets or removes headers. Nest's own app.useSecurityHeaders() uses the
 * same hook, so enabling it as well would replace Helmet on that rejected-request path.
 */
function registerSecurityHeaders(app: INestApplication): void {
  const adapter = app.getHttpAdapter();
  if (typeof adapter.registerSecurityHook !== 'function') {
    throw new Error('The HTTP adapter cannot run the security headers before routing.');
  }
  const securityHeaders = helmet();
  const hook: SecurityHeaderHook = (request, response) => {
    let failure: unknown;
    securityHeaders(request, response as unknown as ServerResponse, (error?: unknown) => {
      failure = error;
    });
    return failure instanceof Error ? failure : undefined;
  };
  adapter.registerSecurityHook(hook);
}

export function buildHttpCorsOptions(allowedOrigins: readonly string[]): HttpCorsOptions | null {
  if (allowedOrigins.length === 0) {
    return null;
  }

  return {
    origin: [...allowedOrigins],
    credentials: false,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    optionsSuccessStatus: 204,
  };
}

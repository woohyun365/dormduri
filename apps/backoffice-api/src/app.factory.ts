import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NodeAdapter } from '@nestjs/platform-node';
import helmet from 'helmet';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { BackofficeAppModule } from './app.module.js';
import type { BackofficeSettings } from './platform/config/backoffice-settings.js';
import { ApiExceptionFilter } from './platform/http/api-exception.filter.js';
import { BackofficeLogger } from './platform/observability/backoffice-logger.js';
import { SystemClock, type Clock } from './platform/time/clock.js';

type SecurityHook = (
  request: IncomingMessage,
  response: {
    setHeader(name: string, value: string): unknown;
    removeHeader(name: string): unknown;
  },
) => Error | undefined;

/**
 * Helmet runs through the adapter's security hook so even a request the router rejects keeps the
 * headers (the same wiring as the user API). The API answers only the BFF, so `no-store` and a
 * deny-all CSP fit every response.
 */
function registerSecurityHeaders(app: INestApplication): void {
  const adapter = app.getHttpAdapter();
  if (typeof adapter.registerSecurityHook !== 'function') {
    throw new Error('The HTTP adapter cannot run security headers before routing.');
  }
  const headers = helmet({
    // A JSON API for the BFF only: no helmet defaults (script/style/img sources) are merged in.
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    referrerPolicy: { policy: 'no-referrer' },
    hsts: false,
  });
  const hook: SecurityHook = (request, response) => {
    let failure: unknown;
    headers(request, response as unknown as ServerResponse, (error?: unknown) => {
      failure = error;
    });
    response.setHeader('Cache-Control', 'no-store');
    return failure instanceof Error ? failure : undefined;
  };
  adapter.registerSecurityHook(hook);
}

export async function createBackofficeApplication(
  settings: BackofficeSettings,
  overrides: { clock?: Clock; logger?: BackofficeLogger } = {},
): Promise<INestApplication> {
  const logger = overrides.logger ?? new BackofficeLogger(settings.logLevel);
  const app = await NestFactory.create(
    BackofficeAppModule.register({ settings, clock: overrides.clock ?? new SystemClock(), logger }),
    new NodeAdapter({}),
    { logger, abortOnError: false },
  );
  registerSecurityHeaders(app);
  app.useGlobalFilters(new ApiExceptionFilter(logger));
  app.enableShutdownHooks();
  return app;
}

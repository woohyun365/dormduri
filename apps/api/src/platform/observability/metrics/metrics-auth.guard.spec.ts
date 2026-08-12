import { NotFoundException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import observabilityConfig from '../observability.config.js';
import { MetricsAuthGuard } from './metrics-auth.guard.js';

function makeSettings(
  overrides: Partial<ConfigType<typeof observabilityConfig>> = {},
): ConfigType<typeof observabilityConfig> {
  return {
    env: 'test',
    logHashSecret: 'test-secret',
    logLevel: 'info',
    logPretty: false,
    metricsEnabled: true,
    metricsBearerToken: 'metrics-secret',
    metricsRoute: 'internal/metrics',
    metricsHttpDurationBuckets: [0.05, 0.1, 0.2],
    serviceName: 'api',
    ...overrides,
  };
}

function makeContext(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: { authorization },
      }),
    }),
  } as ExecutionContext;
}

describe('MetricsAuthGuard', () => {
  it('allows the configured bearer token', () => {
    const guard = new MetricsAuthGuard(makeSettings());

    expect(guard.canActivate(makeContext('Bearer metrics-secret'))).toBe(true);
  });

  it('rejects missing or invalid bearer token when configured', () => {
    const guard = new MetricsAuthGuard(makeSettings());

    expect(() => guard.canActivate(makeContext())).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(makeContext('Bearer wrong'))).toThrow(UnauthorizedException);
  });

  it('keeps local/test scrape explicitly open when no token is configured', () => {
    const guard = new MetricsAuthGuard(
      makeSettings({ metricsEnabled: true, metricsBearerToken: null }),
    );

    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it('rejects scrape when metrics are disabled', () => {
    const guard = new MetricsAuthGuard(makeSettings({ metricsEnabled: false }));

    expect(() => guard.canActivate(makeContext('Bearer metrics-secret'))).toThrow(
      NotFoundException,
    );
  });

  it('does not open production scrape when token is missing despite env validation fallback', () => {
    const guard = new MetricsAuthGuard(
      makeSettings({ env: 'production', metricsEnabled: true, metricsBearerToken: null }),
    );

    expect(() => guard.canActivate(makeContext())).toThrow(UnauthorizedException);
  });
});

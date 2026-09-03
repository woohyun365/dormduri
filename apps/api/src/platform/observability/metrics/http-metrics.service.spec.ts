import { describe, expect, it } from 'vitest';
import type { ConfigType } from '@nestjs/config';
import observabilityConfig from '../observability.config.js';
import { HttpMetricsService } from './http-metrics.service.js';
import { PrometheusRegistryService } from './prometheus-registry.service.js';

const settings = {
  env: 'test',
  logHashSecret: 'test-secret',
  logLevel: 'info',
  logPretty: false,
  metricsEnabled: true,
  metricsBearerToken: 'metrics-secret',
  metricsRoute: 'internal/metrics',
  metricsHttpDurationBuckets: [0.05, 0.1, 0.2],
  serviceName: 'api',
} satisfies ConfigType<typeof observabilityConfig>;

function createHarness(overrides: Partial<ConfigType<typeof observabilityConfig>> = {}) {
  const currentSettings = { ...settings, ...overrides };
  const registry = new PrometheusRegistryService(currentSettings);
  const metrics = new HttpMetricsService(registry, currentSettings);
  return { metrics, registry };
}

describe('HttpMetricsService', () => {
  it('records bounded HTTP request metrics', async () => {
    const { metrics, registry } = createHarness();

    const finish = metrics.startRequest('/api/auth/login');
    metrics.recordRequest({
      durationSeconds: 0.123,
      method: 'post',
      route: '/api/auth/login',
      statusCode: 201,
    });
    finish();

    const scrape = await registry.metrics();
    expect(scrape).toContain('api_http_requests_total');
    expect(scrape).toContain('method="POST"');
    expect(scrape).toContain('route="/api/auth/login"');
    expect(scrape).toContain('status_class="2xx"');
    expect(scrape).toContain('api_http_request_duration_seconds_bucket');
    for (const bucket of ['0.05', '0.1', '0.2', '+Inf']) {
      expect(scrape).toContain(`le="${bucket}"`);
    }
    expect(scrape).toContain('api_http_request_in_flight{route="/api/auth/login"');
    expect(scrape).not.toContain('userId');
  });

  it('does not record request metrics when metrics are disabled', async () => {
    const { metrics, registry } = createHarness({ metricsEnabled: false });

    const finish = metrics.startRequest('/api/auth/login');
    metrics.recordRequest({
      durationSeconds: 0.123,
      method: 'POST',
      route: '/api/auth/login',
      statusCode: 200,
    });
    metrics.recordException({ code: 'BAD_REQUEST', statusCode: 400 });
    finish();

    const scrape = await registry.metrics();
    expect(scrape).not.toContain('api_http_requests_total{');
    expect(scrape).not.toContain('api_exceptions_total{');
  });

  it('records normalized exception metrics', async () => {
    const { metrics, registry } = createHarness();

    metrics.recordException({ code: 'auth invalid email', domain: 'Auth', statusCode: 401 });

    const scrape = await registry.metrics();
    expect(scrape).toContain('api_exceptions_total');
    expect(scrape).toContain('code="AUTH_INVALID_EMAIL"');
    expect(scrape).toContain('domain="auth"');
    expect(scrape).toContain('status_class="4xx"');
  });
});

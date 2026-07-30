import { describe, expect, it } from 'vitest';
import type { ConfigType } from '@nestjs/config';
import observabilityConfig from '../../../config/observability.config.js';
import { DomainPrometheusMetricsService } from './domain-prometheus-metrics.service.js';
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
  const metrics = new DomainPrometheusMetricsService(registry, currentSettings);
  return { metrics, registry };
}

describe('DomainPrometheusMetricsService', () => {
  it('registers bounded domain metrics through the shared registry', async () => {
    const { metrics, registry } = createHarness();

    metrics.incrementCounter({
      name: 'api_realtime_dispatch_batches_total',
      labels: { dispatcher: 'chat', outcome: 'success' },
    });
    metrics.setGauge({
      name: 'api_realtime_dispatch_oldest_claimed_outbox_lag_seconds',
      labels: { dispatcher: 'chat' },
      value: 3,
    });
    metrics.observeHistogram({
      name: 'api_roommate_search_duration_seconds',
      labels: { outcome: 'success', sort: 'MATCH_SCORE' },
      value: 0.12,
    });
    metrics.incrementCounter({
      name: 'api_auth_session_renewals_total',
      labels: { outcome: 'renewed' },
    });

    const scrape = await registry.metrics();
    expect(scrape).toContain('api_realtime_dispatch_batches_total');
    expect(scrape).toContain('dispatcher="chat"');
    expect(scrape).toContain('outcome="success"');
    expect(scrape).toContain('api_realtime_dispatch_oldest_claimed_outbox_lag_seconds');
    expect(scrape).toContain('api_roommate_search_duration_seconds_bucket');
    expect(scrape).toContain('sort="match_score"');
    expect(scrape).toContain('api_auth_session_renewals_total');
    expect(scrape).toContain('outcome="renewed"');
  });

  it('rejects unknown or forbidden labels before they reach Prometheus', () => {
    const { metrics } = createHarness();

    expect(() =>
      metrics.incrementCounter({
        name: 'api_realtime_dispatch_batches_total',
        labels: { dispatcher: 'chat', outcome: 'success', userId: 'user-1' } as never,
      }),
    ).toThrow('Unexpected labels');
  });

  it('does not emit domain metric samples when metrics are disabled', async () => {
    const { metrics, registry } = createHarness({ metricsEnabled: false });

    metrics.incrementCounter({
      name: 'api_chat_realtime_connections_total',
    });

    const scrape = await registry.metrics();
    expect(scrape).not.toContain('api_chat_realtime_connections_total');
  });
});

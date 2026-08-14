import { describe, expect, it } from 'vitest';
import type { ConfigType } from '@nestjs/config';
import observabilityConfig from '../observability.config.js';
import { DomainMetricDefinitionRegistryService } from './domain-metric-definition-registry.service.js';
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

const testDefinitions = [
  {
    name: 'api_test_operations_total',
    kind: 'counter',
    help: 'Test operation outcomes.',
    labelNames: ['outcome'],
  },
  {
    name: 'api_test_in_flight',
    kind: 'gauge',
    help: 'Test in-flight operations.',
    labelNames: ['operation'],
  },
  {
    name: 'api_test_duration_seconds',
    kind: 'histogram',
    help: 'Test operation duration.',
    labelNames: ['operation', 'outcome'],
    buckets: [0.01, 0.1, 1],
  },
] as const;

function createHarness(overrides: Partial<ConfigType<typeof observabilityConfig>> = {}) {
  const currentSettings = { ...settings, ...overrides };
  const registry = new PrometheusRegistryService(currentSettings);
  const definitions = new DomainMetricDefinitionRegistryService();
  definitions.register('test', testDefinitions);
  const metrics = new DomainPrometheusMetricsService(registry, definitions, currentSettings);
  return { definitions, metrics, registry };
}

describe('DomainPrometheusMetricsService', () => {
  it('registers generic bounded metrics through the shared registry', async () => {
    const { metrics, registry } = createHarness();

    metrics.incrementCounter({
      name: 'api_test_operations_total',
      labels: { outcome: 'success' },
    });
    metrics.setGauge({
      name: 'api_test_in_flight',
      labels: { operation: 'probe' },
      value: 2,
    });
    metrics.observeHistogram({
      name: 'api_test_duration_seconds',
      labels: { operation: 'probe', outcome: 'success' },
      value: 0.12,
    });

    const scrape = await registry.metrics();
    expect(scrape).toContain('api_test_operations_total');
    expect(scrape).toContain('outcome="success"');
    expect(scrape).toContain('api_test_in_flight');
    expect(scrape).toContain('api_test_duration_seconds_bucket');
    expect(scrape).not.toContain('user-1');
  });

  it('rejects unknown metrics and forbidden labels before Prometheus recording', () => {
    const { metrics } = createHarness();

    expect(() =>
      metrics.incrementCounter({
        name: 'api_unknown_total',
      }),
    ).toThrow('Unsupported counter domain metric');
    expect(() =>
      metrics.incrementCounter({
        name: 'api_test_operations_total',
        labels: { outcome: 'success', userId: 'user-1' } as never,
      }),
    ).toThrow('Unexpected labels');
  });

  it('does not emit domain metric samples when metrics are disabled', async () => {
    const { metrics, registry } = createHarness({ metricsEnabled: false });

    metrics.incrementCounter({
      name: 'api_test_operations_total',
      labels: { outcome: 'success' },
    });

    const scrape = await registry.metrics();
    expect(scrape).not.toContain('api_test_operations_total');
  });
});

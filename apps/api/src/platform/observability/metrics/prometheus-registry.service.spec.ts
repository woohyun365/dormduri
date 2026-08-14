import { describe, expect, it } from 'vitest';
import { Counter } from 'prom-client';
import type { ConfigType } from '@nestjs/config';
import observabilityConfig from '../observability.config.js';
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

describe('PrometheusRegistryService', () => {
  it('provides an isolated registry with process metrics and default labels', async () => {
    const registry = new PrometheusRegistryService(settings);
    const register = registry.getRegister();

    expect(registry.getContentType()).toContain('text/plain');
    expect(register.getSingleMetric('process_cpu_user_seconds_total')).toBeDefined();

    const metrics = await registry.metrics();
    expect(metrics).toContain('process_cpu_user_seconds_total');
    expect(metrics).toContain('service="api"');
    expect(metrics).toContain('env="test"');
  });

  it('returns existing metric when the same metric name is requested twice', () => {
    const registry = new PrometheusRegistryService(settings);
    const createCounter = () =>
      new Counter({
        name: 'test_duplicate_safe_total',
        help: 'Test duplicate-safe metric registration.',
        registers: [registry.getRegister()],
      });

    const first = registry.getOrCreateMetric('test_duplicate_safe_total', createCounter);
    const second = registry.getOrCreateMetric('test_duplicate_safe_total', createCounter);

    expect(second).toBe(first);
  });
});

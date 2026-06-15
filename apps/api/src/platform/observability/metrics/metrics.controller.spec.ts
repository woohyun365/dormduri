import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import { AUTH_ACCESS_METADATA_KEY } from '../../../auth/access/auth-access.decorator.js';
import { MetricsController } from './metrics.controller.js';
import type { PrometheusRegistryService } from './prometheus-registry.service.js';

describe('MetricsController', () => {
  it('bypasses the global authenticated-user guard so the metrics bearer guard owns access', () => {
    expect(Reflect.getMetadata(AUTH_ACCESS_METADATA_KEY, MetricsController)).toBe('public');
  });

  it('returns Prometheus text with registry content type', async () => {
    const type = vi.fn();
    const controller = new MetricsController({
      getContentType: () => 'text/plain; version=0.0.4; charset=utf-8',
      metrics: vi.fn(() => Promise.resolve('# HELP api_http_requests_total test\n')),
    } as unknown as PrometheusRegistryService);
    const response = {
      type,
    } as unknown as Response;

    await expect(controller.scrape(response)).resolves.toContain('api_http_requests_total');
    expect(type).toHaveBeenCalledWith('text/plain; version=0.0.4; charset=utf-8');
  });
});

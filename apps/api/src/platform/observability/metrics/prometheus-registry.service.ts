import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { collectDefaultMetrics, Registry, type Metric } from '@prometheus-io/client';
import observabilityConfig from '../observability.config.js';

@Injectable()
export class PrometheusRegistryService {
  private readonly registry = new Registry();

  constructor(
    @Inject(observabilityConfig.KEY)
    private readonly settings: ConfigType<typeof observabilityConfig>,
  ) {
    this.registry.setDefaultLabels({
      env: settings.env,
      service: settings.serviceName,
    });
    collectDefaultMetrics({ register: this.registry });
  }

  getRegister(): Registry {
    return this.registry;
  }

  getOrCreateMetric<TMetric extends Metric<string>>(
    metricName: string,
    createMetric: () => TMetric,
  ): TMetric {
    const existingMetric = this.registry.getSingleMetric(metricName);
    if (existingMetric) {
      return existingMetric as TMetric;
    }

    return createMetric();
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  async metrics(): Promise<string> {
    return this.registry.metrics();
  }
}

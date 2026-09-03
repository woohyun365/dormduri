import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Counter, Gauge, Histogram } from '@prometheus-io/client';
import observabilityConfig from '../observability.config.js';
import {
  normalizeDomainMetricLabelValue,
  type DomainMetricLabelName,
} from './metric-label.policy.js';
import { DomainMetricDefinitionRegistryService } from './domain-metric-definition-registry.service.js';
import { PrometheusRegistryService } from './prometheus-registry.service.js';
import type {
  DomainCounterMetricInput,
  DomainGaugeMetricInput,
  DomainHistogramMetricInput,
  DomainMetricDefinition,
  DomainMetricLabelValues,
  DomainMetricsPort,
} from './domain-metrics.port.js';

type DomainMetric = Counter<string> | Gauge<string> | Histogram<string>;

type DomainMetricLabelSet = Record<string, string>;

@Injectable()
export class DomainPrometheusMetricsService implements DomainMetricsPort {
  private readonly metrics = new Map<string, DomainMetric>();

  constructor(
    private readonly registryService: PrometheusRegistryService,
    private readonly definitionRegistry: DomainMetricDefinitionRegistryService,
    @Inject(observabilityConfig.KEY)
    private readonly settings: ConfigType<typeof observabilityConfig>,
  ) {}

  incrementCounter(input: DomainCounterMetricInput): void {
    if (!this.settings.metricsEnabled) {
      return;
    }

    const definition = this.requireDefinition(input.name, 'counter');
    const metric = this.getMetric(definition) as Counter<string>;
    metric.inc(this.normalizeLabels(definition, input.labels), Math.max(0, input.value ?? 1));
  }

  setGauge(input: DomainGaugeMetricInput): void {
    if (!this.settings.metricsEnabled) {
      return;
    }

    const definition = this.requireDefinition(input.name, 'gauge');
    const metric = this.getMetric(definition) as Gauge<string>;
    metric.set(this.normalizeLabels(definition, input.labels), Math.max(0, input.value));
  }

  observeHistogram(input: DomainHistogramMetricInput): void {
    if (!this.settings.metricsEnabled) {
      return;
    }

    const definition = this.requireDefinition(input.name, 'histogram');
    const metric = this.getMetric(definition) as Histogram<string>;
    metric.observe(this.normalizeLabels(definition, input.labels), Math.max(0, input.value));
  }

  private requireDefinition(name: string, kind: DomainMetricDefinition['kind']) {
    return this.definitionRegistry.require(name, kind);
  }

  private getMetric(definition: DomainMetricDefinition): DomainMetric {
    const existingMetric = this.metrics.get(definition.name);
    if (existingMetric) {
      return existingMetric;
    }

    const registry = this.registryService.getRegister();
    const metric = this.registryService.getOrCreateMetric(definition.name, (): DomainMetric => {
      const options = {
        name: definition.name,
        help: definition.help,
        labelNames: definition.labelNames,
        registers: [registry],
      };

      if (definition.kind === 'counter') {
        return new Counter(options);
      }
      if (definition.kind === 'gauge') {
        return new Gauge(options);
      }
      return new Histogram({
        ...options,
        buckets: definition.buckets ? [...definition.buckets] : undefined,
      });
    });

    this.metrics.set(definition.name, metric);
    return metric;
  }

  private normalizeLabels(
    definition: DomainMetricDefinition,
    labels: DomainMetricLabelValues = {},
  ): DomainMetricLabelSet {
    const labelNames = definition.labelNames;
    const actualLabelNames = Object.keys(labels);
    const unexpectedLabels = actualLabelNames.filter(
      (labelName) => !labelNames.includes(labelName as DomainMetricLabelName),
    );
    if (unexpectedLabels.length > 0) {
      throw new Error(
        `Unexpected labels for ${definition.name}: ${unexpectedLabels.sort().join(', ')}`,
      );
    }

    return Object.fromEntries(
      labelNames.map((labelName) => [
        labelName,
        normalizeDomainMetricLabelValue(labels[labelName]),
      ]),
    );
  }
}

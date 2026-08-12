import type { DomainMetricLabelName } from './metric-label.policy.js';

export const DOMAIN_METRICS_PORT = Symbol('DOMAIN_METRICS_PORT');

export type DomainMetricKind = 'counter' | 'gauge' | 'histogram';

export type DomainMetricName = string;

export type DomainMetricLabelValues = Partial<
  Record<DomainMetricLabelName, string | number | boolean>
>;

export interface DomainMetricDefinition {
  readonly name: DomainMetricName;
  readonly kind: DomainMetricKind;
  readonly help: string;
  readonly labelNames: readonly DomainMetricLabelName[];
  readonly buckets?: readonly number[];
}

export interface DomainCounterMetricInput {
  readonly name: DomainMetricName;
  readonly labels?: DomainMetricLabelValues;
  readonly value?: number;
}

export interface DomainGaugeMetricInput {
  readonly name: DomainMetricName;
  readonly labels?: DomainMetricLabelValues;
  readonly value: number;
}

export interface DomainHistogramMetricInput {
  readonly name: DomainMetricName;
  readonly labels?: DomainMetricLabelValues;
  readonly value: number;
}

export interface DomainMetricsPort {
  incrementCounter(input: DomainCounterMetricInput): void;
  setGauge(input: DomainGaugeMetricInput): void;
  observeHistogram(input: DomainHistogramMetricInput): void;
}

export function recordDomainMetricSafely(
  metrics: DomainMetricsPort | undefined,
  record: (metrics: DomainMetricsPort) => void,
): void {
  if (!metrics) {
    return;
  }

  try {
    record(metrics);
  } catch {
    // Metrics are operational side effects only. Product requests and lifecycle jobs must not fail
    // because the metrics bridge is disabled, misconfigured, or rejects an unsafe label.
  }
}

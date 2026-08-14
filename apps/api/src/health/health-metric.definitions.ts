import type { DomainMetricDefinition } from '../platform/observability/metrics/domain-metrics.port.js';

export const HEALTH_METRIC_DEFINITIONS = [
  {
    name: 'api_health_readiness_total',
    kind: 'counter',
    help: 'Total API readiness outcomes by bounded result.',
    labelNames: ['outcome'],
  },
  {
    name: 'api_health_readiness_failures_total',
    kind: 'counter',
    help: 'Total API readiness check failures by bounded reason.',
    labelNames: ['reason'],
  },
  {
    name: 'api_health_readiness_duration_seconds',
    kind: 'histogram',
    help: 'API readiness probe duration seconds by bounded outcome.',
    labelNames: ['outcome'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  },
] as const satisfies readonly DomainMetricDefinition[];

import type { DomainMetricDefinition } from '../../platform/observability/metrics/domain-metrics.port.js';

export const RETENTION_METRIC_DEFINITIONS = [
  {
    name: 'api_retention_backlog_total',
    kind: 'gauge',
    help: 'Retention backlog gauge by bounded target and state.',
    labelNames: ['target', 'state'],
  },
  {
    name: 'api_retention_sweep_duration_seconds',
    kind: 'histogram',
    help: 'Retention sweep duration seconds by target and outcome.',
    labelNames: ['target', 'outcome'],
    buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
  },
  {
    name: 'api_retention_review_jobs_total',
    kind: 'counter',
    help: 'Total observed retention review jobs by target and outcome.',
    labelNames: ['target', 'outcome'],
  },
] as const satisfies readonly DomainMetricDefinition[];

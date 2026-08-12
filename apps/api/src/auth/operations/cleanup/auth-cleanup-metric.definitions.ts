import type { DomainMetricDefinition } from '../../../platform/observability/metrics/domain-metrics.port.js';

export const AUTH_CLEANUP_METRIC_DEFINITIONS = [
  {
    name: 'api_auth_cleanup_deleted_total',
    kind: 'counter',
    help: 'Total auth cleanup deleted rows by bounded target.',
    labelNames: ['target'],
  },
  {
    name: 'api_auth_cleanup_failures_total',
    kind: 'counter',
    help: 'Total auth operational cleanup failures.',
    labelNames: [],
  },
  {
    name: 'api_auth_cleanup_batch_saturated',
    kind: 'gauge',
    help: 'Whether the latest auth cleanup batch reached its per-target limit.',
    labelNames: ['target'],
  },
] as const satisfies readonly DomainMetricDefinition[];

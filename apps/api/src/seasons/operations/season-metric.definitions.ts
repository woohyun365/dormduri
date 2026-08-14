import type { DomainMetricDefinition } from '../../platform/observability/metrics/domain-metrics.port.js';

export const SEASON_METRIC_DEFINITIONS = [
  {
    name: 'api_seasons_current_query_total',
    kind: 'counter',
    help: 'Total current season context queries by campus and cache state.',
    labelNames: ['campus', 'cache'],
  },
  {
    name: 'api_seasons_current_query_duration_seconds',
    kind: 'histogram',
    help: 'Current season context query duration seconds by campus and cache state.',
    labelNames: ['campus', 'cache'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  },
  {
    name: 'api_seasons_operation_total',
    kind: 'counter',
    help: 'Total season operation outcomes by action, campus, and outcome.',
    labelNames: ['action', 'campus', 'outcome'],
  },
] as const satisfies readonly DomainMetricDefinition[];

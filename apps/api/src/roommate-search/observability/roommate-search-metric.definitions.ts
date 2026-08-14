import type { DomainMetricDefinition } from '../../platform/observability/metrics/domain-metrics.port.js';

export const ROOMMATE_SEARCH_METRIC_DEFINITIONS = [
  {
    name: 'api_roommate_search_requests_total',
    kind: 'counter',
    help: 'Total roommate search requests by outcome and sort.',
    labelNames: ['outcome', 'sort'],
  },
  {
    name: 'api_roommate_search_duration_seconds',
    kind: 'histogram',
    help: 'Roommate search request duration seconds by outcome and sort.',
    labelNames: ['outcome', 'sort'],
    buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  },
  {
    name: 'api_roommate_search_candidate_count',
    kind: 'histogram',
    help: 'Roommate search candidate count by pipeline phase.',
    labelNames: ['phase'],
    buckets: [0, 1, 2, 5, 10, 20, 50, 100, 250, 500],
  },
] as const satisfies readonly DomainMetricDefinition[];

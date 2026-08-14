import type { DomainMetricDefinition } from '../observability/metrics/domain-metrics.port.js';

export const PRISMA_METRIC_DEFINITIONS = [
  {
    name: 'api_prisma_pool_connections',
    kind: 'gauge',
    help: 'Current Prisma managed pg pool connections by state.',
    labelNames: ['state'],
  },
  {
    name: 'api_prisma_transaction_retries_total',
    kind: 'counter',
    help: 'Total Prisma serializable transaction retry outcomes.',
    labelNames: ['outcome'],
  },
] as const satisfies readonly DomainMetricDefinition[];

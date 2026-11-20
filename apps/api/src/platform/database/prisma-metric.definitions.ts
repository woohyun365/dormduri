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
  {
    name: 'api_db_table_dead_tuple_ratio',
    kind: 'gauge',
    help: 'Dead tuples divided by live tuples (at least one) for a watched table.',
    labelNames: ['table'],
  },
  {
    name: 'api_db_table_dead_tuples',
    kind: 'gauge',
    help: 'Estimated dead tuples for a watched table.',
    labelNames: ['table'],
  },
  {
    name: 'api_db_table_last_autovacuum_timestamp_seconds',
    kind: 'gauge',
    help: 'Unix time in seconds of the last autovacuum of a watched table.',
    labelNames: ['table'],
  },
] as const satisfies readonly DomainMetricDefinition[];

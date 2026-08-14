import type { DomainMetricDefinition } from '../../platform/observability/metrics/domain-metrics.port.js';

export const CHAT_REALTIME_METRIC_DEFINITIONS = [
  {
    name: 'api_chat_realtime_connected_sockets',
    kind: 'gauge',
    help: 'Current connected chat realtime sockets.',
    labelNames: [],
  },
  {
    name: 'api_chat_realtime_connections_total',
    kind: 'counter',
    help: 'Total accepted chat realtime socket connections.',
    labelNames: [],
  },
  {
    name: 'api_realtime_dispatch_batches_total',
    kind: 'counter',
    help: 'Total realtime outbox dispatcher batches by dispatcher and outcome.',
    labelNames: ['dispatcher', 'outcome'],
  },
  {
    name: 'api_realtime_dispatch_oldest_claimed_outbox_lag_seconds',
    kind: 'gauge',
    help: 'Oldest claimed realtime outbox lag in seconds by dispatcher.',
    labelNames: ['dispatcher'],
  },
  {
    name: 'api_realtime_publish_failures_total',
    kind: 'counter',
    help: 'Total realtime publish failures by dispatcher.',
    labelNames: ['dispatcher'],
  },
  {
    name: 'api_chat_realtime_rejections_total',
    kind: 'counter',
    help: 'Total chat realtime request/socket rejections by bounded reason and scope.',
    labelNames: ['reason', 'scope'],
  },
  {
    name: 'api_chat_realtime_outbox_prune_total',
    kind: 'counter',
    help: 'Total chat realtime outbox prune outcomes.',
    labelNames: ['outcome'],
  },
] as const satisfies readonly DomainMetricDefinition[];

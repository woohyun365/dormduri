import type { DomainMetricLabelName } from './metric-label.policy.js';

export const DOMAIN_METRICS_PORT = Symbol('DOMAIN_METRICS_PORT');

export type DomainMetricKind = 'counter' | 'gauge' | 'histogram';

export type DomainMetricName =
  | 'api_auth_cleanup_deleted_total'
  | 'api_auth_cleanup_failures_total'
  | 'api_auth_cleanup_lag_seconds'
  | 'api_auth_credential_transitions_total'
  | 'api_auth_login_attempts_total'
  | 'api_auth_login_password_verify_duration_seconds'
  | 'api_auth_login_password_verify_in_flight'
  | 'api_auth_login_throttle_total'
  | 'api_auth_mail_dispatch_total'
  | 'api_auth_mail_outbox_lag_seconds'
  | 'api_auth_security_alert_active'
  | 'api_auth_session_renewals_total'
  | 'api_auth_verification_operations_total'
  | 'api_auth_redis_gate_state'
  | 'api_chat_realtime_connected_sockets'
  | 'api_chat_realtime_connections_total'
  | 'api_chat_realtime_outbox_prune_total'
  | 'api_chat_realtime_rejections_total'
  | 'api_prisma_pool_connections'
  | 'api_prisma_transaction_retries_total'
  | 'api_realtime_dispatch_batches_total'
  | 'api_realtime_dispatch_oldest_claimed_outbox_lag_seconds'
  | 'api_retention_backlog_total'
  | 'api_retention_review_jobs_total'
  | 'api_retention_sweep_duration_seconds'
  | 'api_roommate_search_candidate_count'
  | 'api_roommate_search_duration_seconds'
  | 'api_roommate_search_requests_total'
  | 'api_seasons_current_query_duration_seconds'
  | 'api_seasons_current_query_total'
  | 'api_seasons_operation_total';

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

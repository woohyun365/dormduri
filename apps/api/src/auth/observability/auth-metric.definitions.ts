import type { DomainMetricDefinition } from '../../platform/observability/metrics/domain-metrics.port.js';

export const AUTH_METRIC_DEFINITIONS = [
  counter(
    'api_auth_credential_transitions_total',
    'Total auth credential transition outcomes after their owning transaction boundary.',
    ['operation', 'outcome'],
  ),
  counter(
    'api_auth_verification_operations_total',
    'Total auth verification request, verify, and grant outcomes by bounded purpose.',
    ['operation', 'outcome', 'scope'],
  ),
  counter('api_auth_mail_dispatch_total', 'Total terminal auth mail outbox dispatch outcomes.', [
    'outcome',
  ]),
  gauge(
    'api_auth_mail_outbox_lag_seconds',
    'Oldest claimed auth mail outbox event lag in seconds.',
  ),
  counter('api_auth_login_attempts_total', 'Total login command outcomes by bounded result.', [
    'outcome',
  ]),
  counter(
    'api_auth_login_throttle_total',
    'Total login network throttle rejections by bounded scope.',
    ['scope'],
  ),
  histogram(
    'api_auth_login_password_verify_duration_seconds',
    'Login password verification duration seconds by safe real or dummy target.',
    ['target'],
    [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  ),
  gauge(
    'api_auth_login_password_verify_in_flight',
    'Current login password verification operations by safe real or dummy target.',
    ['target'],
  ),
  counter(
    'api_auth_password_hash_admission_total',
    'Total process-local password hash admission outcomes by bounded operation.',
    ['operation', 'outcome'],
  ),
  histogram(
    'api_auth_password_hash_duration_seconds',
    'Password hash or verify duration seconds by bounded operation and target.',
    ['operation', 'target'],
    [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  ),
  gauge(
    'api_auth_password_hash_in_flight',
    'Current process-local Argon password operations by bounded operation.',
    ['operation'],
  ),
  counter(
    'api_auth_password_policy_rejected_total',
    'Total new-password policy rejections by bounded operation and reason.',
    ['operation', 'reason'],
  ),
  counter(
    'api_auth_session_renewals_total',
    'Total session renewal outcomes by bounded lifecycle result.',
    ['outcome'],
  ),
  counter(
    'api_auth_signup_nickname_validation_total',
    'Total signup nickname validation outcomes by bounded result.',
    ['outcome'],
  ),
  counter(
    'api_auth_signup_final_admission_total',
    'Total final signup admission outcomes before password hashing.',
    ['outcome'],
  ),
  counter('api_auth_signup_password_hash_total', 'Total signup password hash lifecycle outcomes.', [
    'outcome',
  ]),
  histogram(
    'api_auth_signup_password_hash_duration_seconds',
    'Signup password hash duration seconds by bounded outcome.',
    ['outcome'],
    [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  ),
  counter(
    'api_auth_sensitive_mutations_total',
    'Total protected auth mutation outcomes by bounded operation.',
    ['operation', 'outcome'],
  ),
] as const satisfies readonly DomainMetricDefinition[];

function counter(
  name: string,
  help: string,
  labelNames: DomainMetricDefinition['labelNames'] = [],
): DomainMetricDefinition {
  return { name, kind: 'counter', help, labelNames };
}

function gauge(
  name: string,
  help: string,
  labelNames: DomainMetricDefinition['labelNames'] = [],
): DomainMetricDefinition {
  return { name, kind: 'gauge', help, labelNames };
}

function histogram(
  name: string,
  help: string,
  labelNames: DomainMetricDefinition['labelNames'],
  buckets: readonly number[],
): DomainMetricDefinition {
  return { name, kind: 'histogram', help, labelNames, buckets };
}

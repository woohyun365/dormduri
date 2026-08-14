import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  DOMAIN_METRICS_PORT,
  recordDomainMetricSafely,
  type DomainMetricsPort,
} from '../../platform/observability/metrics/domain-metrics.port.js';
import type { AuthPasswordPolicyRejectionReason } from './password-policy/auth-password-structure.policy.js';

export type AuthCredentialTransitionOperation = 'signup' | 'reset_password' | 'change_password';
export type AuthPasswordPolicyOperation = 'signup' | 'reset_password' | 'change_password';
export type AuthSensitiveMutationOperation = 'signup' | 'change_password';
export type AuthSensitiveMutationOutcome =
  | 'allowed'
  | 'throttled'
  | 'committed'
  | 'rejected'
  | 'session_required'
  | 'stale'
  | 'replacement_session_failed'
  | 'outbox_append_failed'
  | 'audit_append_failed'
  | 'failed';

@Injectable()
export class AuthCredentialMetricsService {
  constructor(
    @Optional()
    @Inject(DOMAIN_METRICS_PORT)
    private readonly domainMetrics?: DomainMetricsPort,
  ) {}

  recordTransition(operation: AuthCredentialTransitionOperation, outcome: string) {
    recordDomainMetricSafely(this.domainMetrics, (metrics) =>
      metrics.incrementCounter({
        name: 'api_auth_credential_transitions_total',
        labels: { operation, outcome },
      }),
    );
  }

  recordPasswordPolicyRejected(
    operation: AuthPasswordPolicyOperation,
    reason: AuthPasswordPolicyRejectionReason,
  ) {
    recordDomainMetricSafely(this.domainMetrics, (metrics) =>
      metrics.incrementCounter({
        name: 'api_auth_password_policy_rejected_total',
        labels: { operation, reason },
      }),
    );
  }

  recordSensitiveMutation(
    operation: AuthSensitiveMutationOperation,
    outcome: AuthSensitiveMutationOutcome,
  ) {
    recordDomainMetricSafely(this.domainMetrics, (metrics) =>
      metrics.incrementCounter({
        name: 'api_auth_sensitive_mutations_total',
        labels: { operation, outcome },
      }),
    );
  }
}

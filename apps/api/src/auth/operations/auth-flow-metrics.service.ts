import { Inject, Injectable, Optional } from '@nestjs/common';
import type { VerificationCodePurpose } from '../../generated/prisma/enums.js';
import {
  DOMAIN_METRICS_PORT,
  recordDomainMetricSafely,
  type DomainMetricsPort,
} from '../../platform/observability/metrics/domain-metrics.port.js';

export type AuthVerificationMetricOperation = 'request' | 'verify' | 'grant';
export type AuthCredentialTransitionOperation = 'signup' | 'reset_password' | 'change_password';
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
export type SignupFinalAdmissionMetricOutcome = 'allowed' | 'grant_required' | 'throttled';
export type SignupPasswordHashMetricOutcome = 'started' | 'completed' | 'failed';
export type SignupNicknameValidationMetricOutcome =
  | 'available'
  | 'invalid'
  | 'moderation_rejected'
  | 'taken'
  | 'verification_required'
  | 'throttled'
  | 'failed';

@Injectable()
export class AuthFlowMetricsService {
  constructor(
    @Optional()
    @Inject(DOMAIN_METRICS_PORT)
    private readonly domainMetrics?: DomainMetricsPort,
  ) {}

  recordVerification(
    purpose: VerificationCodePurpose,
    operation: AuthVerificationMetricOperation,
    outcome: string,
  ) {
    recordDomainMetricSafely(this.domainMetrics, (metrics) =>
      metrics.incrementCounter({
        name: 'api_auth_verification_operations_total',
        labels: {
          operation,
          outcome,
          scope: purpose.toLowerCase(),
        },
      }),
    );
  }

  recordCredentialTransition(operation: AuthCredentialTransitionOperation, outcome: string) {
    recordDomainMetricSafely(this.domainMetrics, (metrics) =>
      metrics.incrementCounter({
        name: 'api_auth_credential_transitions_total',
        labels: { operation, outcome },
      }),
    );
  }

  recordSignupNicknameValidation(outcome: SignupNicknameValidationMetricOutcome) {
    recordDomainMetricSafely(this.domainMetrics, (metrics) =>
      metrics.incrementCounter({
        name: 'api_auth_signup_nickname_validation_total',
        labels: { outcome },
      }),
    );
  }

  recordSignupFinalAdmission(outcome: SignupFinalAdmissionMetricOutcome) {
    recordDomainMetricSafely(this.domainMetrics, (metrics) =>
      metrics.incrementCounter({
        name: 'api_auth_signup_final_admission_total',
        labels: { outcome },
      }),
    );
  }

  recordSignupPasswordHash(outcome: SignupPasswordHashMetricOutcome, durationSeconds?: number) {
    recordDomainMetricSafely(this.domainMetrics, (metrics) => {
      metrics.incrementCounter({
        name: 'api_auth_signup_password_hash_total',
        labels: { outcome },
      });
      if (typeof durationSeconds === 'number') {
        metrics.observeHistogram({
          name: 'api_auth_signup_password_hash_duration_seconds',
          labels: { outcome },
          value: Math.max(0, durationSeconds),
        });
      }
    });
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

  recordMailDispatch(outcome: string, lagSeconds: number) {
    recordDomainMetricSafely(this.domainMetrics, (metrics) => {
      metrics.incrementCounter({
        name: 'api_auth_mail_dispatch_total',
        labels: { outcome },
      });
      metrics.setGauge({
        name: 'api_auth_mail_outbox_lag_seconds',
        value: Math.max(0, lagSeconds),
      });
    });
  }
}

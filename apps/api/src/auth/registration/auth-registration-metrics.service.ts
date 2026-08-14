import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  DOMAIN_METRICS_PORT,
  recordDomainMetricSafely,
  type DomainMetricsPort,
} from '../../platform/observability/metrics/domain-metrics.port.js';

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
export class AuthRegistrationMetricsService {
  constructor(
    @Optional()
    @Inject(DOMAIN_METRICS_PORT)
    private readonly domainMetrics?: DomainMetricsPort,
  ) {}

  recordNicknameValidation(outcome: SignupNicknameValidationMetricOutcome) {
    recordDomainMetricSafely(this.domainMetrics, (metrics) =>
      metrics.incrementCounter({
        name: 'api_auth_signup_nickname_validation_total',
        labels: { outcome },
      }),
    );
  }

  recordFinalAdmission(outcome: SignupFinalAdmissionMetricOutcome) {
    recordDomainMetricSafely(this.domainMetrics, (metrics) =>
      metrics.incrementCounter({
        name: 'api_auth_signup_final_admission_total',
        labels: { outcome },
      }),
    );
  }

  recordPasswordHash(outcome: SignupPasswordHashMetricOutcome, durationSeconds?: number) {
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
}

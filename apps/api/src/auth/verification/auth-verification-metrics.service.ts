import { Inject, Injectable, Optional } from '@nestjs/common';
import type { VerificationCodePurpose } from '../../generated/prisma/enums.js';
import {
  DOMAIN_METRICS_PORT,
  recordDomainMetricSafely,
  type DomainMetricsPort,
} from '../../platform/observability/metrics/domain-metrics.port.js';

export type AuthVerificationMetricOperation = 'request' | 'verify' | 'grant';

@Injectable()
export class AuthVerificationMetricsService {
  constructor(
    @Optional()
    @Inject(DOMAIN_METRICS_PORT)
    private readonly domainMetrics?: DomainMetricsPort,
  ) {}

  record(
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
}

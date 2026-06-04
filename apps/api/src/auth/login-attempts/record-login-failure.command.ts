import { Injectable, Optional } from '@nestjs/common';
import type { LoginResult } from '../auth.types.js';
import type { AuthRequestContext } from '../auth-request-context.js';
import {
  AuthSecurityEventService,
  recordAuthSecurityEventSafely,
} from '../security-events/auth-security-event.service.js';
import { AUTH_SECURITY_EVENT_METRICS } from '../security-events/auth-security-event.types.js';
import {
  buildLoginFailureResult,
  isLoginLockoutThresholdReached,
  loginLockoutTtlSeconds,
} from './login-lockout.policy.js';
import { LoginAttemptRepository } from './login-attempt.repository.js';

@Injectable()
export class RecordLoginFailureCommand {
  constructor(
    private readonly repository: LoginAttemptRepository,
    @Optional() private readonly securityEvents?: AuthSecurityEventService,
  ) {}

  async execute(
    emailNormalized: string,
    requestContext: AuthRequestContext = {},
  ): Promise<LoginResult> {
    const attempt = await this.repository.recordFailure(emailNormalized);
    const failureCount = attempt?.failureCount ?? 1;

    await recordAuthSecurityEventSafely(this.securityEvents, {
      type: 'LOGIN_FAILURE',
      severity: 'WARNING',
      emailNormalized,
      requestIp: requestContext.requestIp,
      userAgent: requestContext.userAgent,
      metadata: {
        metricName: AUTH_SECURITY_EVENT_METRICS.loginFailure,
        failureCount,
      },
    });

    if (isLoginLockoutThresholdReached(failureCount)) {
      await recordAuthSecurityEventSafely(this.securityEvents, {
        type: 'LOGIN_LOCKOUT',
        severity: 'WARNING',
        emailNormalized,
        requestIp: requestContext.requestIp,
        userAgent: requestContext.userAgent,
        metadata: {
          metricName: AUTH_SECURITY_EVENT_METRICS.loginLockout,
          reason: 'threshold_reached',
          failureCount,
          ttlSeconds: loginLockoutTtlSeconds(),
        },
      });
    }

    return buildLoginFailureResult(failureCount);
  }
}

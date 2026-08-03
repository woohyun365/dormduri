import { Injectable, Optional } from '@nestjs/common';
import type { LoginResponse } from '@repo/shared/auth/response';
import type { AuthRequestContext } from '../domain/auth-request-context.js';
import {
  AuthSecurityEventService,
  recordAuthSecurityEventSafely,
} from '../security-events/auth-security-event.service.js';
import { AUTH_SECURITY_EVENT_METRICS } from '../security-events/auth-security-event.types.js';
import { buildActiveLoginLockResult } from './login-lockout.policy.js';
import { LoginAttemptRepository } from './login-attempt.repository.js';

@Injectable()
export class GetActiveLoginLockQuery {
  constructor(
    private readonly repository: LoginAttemptRepository,
    @Optional() private readonly securityEvents?: AuthSecurityEventService,
  ) {}

  async execute(
    emailNormalized: string,
    requestContext: AuthRequestContext = {},
  ): Promise<LoginResponse | null> {
    const attempt = await this.repository.findActiveLock(emailNormalized);

    if (!attempt || attempt.remainingSeconds == null) {
      return null;
    }

    await recordAuthSecurityEventSafely(this.securityEvents, {
      type: 'LOGIN_LOCKOUT',
      severity: 'WARNING',
      emailNormalized,
      requestIp: requestContext.requestIp,
      userAgent: requestContext.userAgent,
      metadata: {
        metricName: AUTH_SECURITY_EVENT_METRICS.loginLockout,
        reason: 'active_lock',
        remainingSeconds: attempt.remainingSeconds,
      },
    });

    return buildActiveLoginLockResult(attempt.remainingSeconds);
  }
}

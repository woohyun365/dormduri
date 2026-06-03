import { Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { getActiveLoginLock, recordLoginFailure } from '../generated/prisma/sql.js';
import { LOGIN_LOCKOUT_ATTEMPTS, LOGIN_LOCKOUT_TTL_SECONDS } from './auth.constants.js';
import type { LoginResult } from './auth.types.js';
import { authFailures } from './auth-failures.js';
import {
  AuthSecurityEventService,
  recordAuthSecurityEventSafely,
} from './auth-security-event.service.js';
import { AUTH_SECURITY_EVENT_METRICS } from './auth-security-event.types.js';
import type { AuthRequestContext } from './auth-request-context.js';

@Injectable()
export class AuthLoginAttemptService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly securityEvents?: AuthSecurityEventService,
  ) {}

  async getActiveLock(
    emailNormalized: string,
    requestContext: AuthRequestContext = {},
  ): Promise<LoginResult | null> {
    const [attempt] = await this.prisma.$queryRawTyped(getActiveLoginLock(emailNormalized));

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

    return authFailures.loginLocked(attempt.remainingSeconds);
  }

  async clearFailures(emailNormalized: string): Promise<void> {
    await this.prisma.loginAttempt.deleteMany({
      where: { emailNormalized },
    });
  }

  async recordLoginFailure(
    emailNormalized: string,
    requestContext: AuthRequestContext = {},
  ): Promise<LoginResult> {
    const [attempt] = await this.prisma.$queryRawTyped(
      recordLoginFailure(
        randomUUID(),
        emailNormalized,
        LOGIN_LOCKOUT_ATTEMPTS,
        LOGIN_LOCKOUT_TTL_SECONDS,
      ),
    );

    const failureCount = attempt?.failureCount ?? 1;
    const locked = failureCount >= LOGIN_LOCKOUT_ATTEMPTS;

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

    if (locked) {
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
          ttlSeconds: LOGIN_LOCKOUT_TTL_SECONDS,
        },
      });
      return authFailures.loginLocked(LOGIN_LOCKOUT_TTL_SECONDS);
    }

    return authFailures.invalidCredentials();
  }
}

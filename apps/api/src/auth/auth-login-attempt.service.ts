import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { getActiveLoginLock, recordLoginFailure } from '../generated/prisma/sql.js';
import { LOGIN_LOCKOUT_ATTEMPTS, LOGIN_LOCKOUT_TTL_SECONDS } from './auth.constants.js';
import type { LoginResult } from './auth.types.js';
import { authFailures } from './auth-failures.js';

@Injectable()
export class AuthLoginAttemptService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveLock(emailNormalized: string): Promise<LoginResult | null> {
    const [attempt] = await this.prisma.$queryRawTyped(getActiveLoginLock(emailNormalized));

    if (!attempt || attempt.remainingSeconds == null) {
      return null;
    }

    return authFailures.loginLocked(attempt.remainingSeconds);
  }

  async clearFailures(emailNormalized: string): Promise<void> {
    await this.prisma.loginAttempt.deleteMany({
      where: { emailNormalized },
    });
  }

  async recordLoginFailure(emailNormalized: string): Promise<LoginResult> {
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

    if (locked) {
      return authFailures.loginLocked(LOGIN_LOCKOUT_TTL_SECONDS);
    }

    return authFailures.invalidCredentials();
  }
}

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { getActiveLoginLock } from '../generated/prisma/sql.js';
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
    const [attempt] = await this.prisma.$queryRaw<
      { failureCount: number; lockedUntil: Date | null }[]
    >`
        INSERT INTO "LoginAttempt" (
          id,
          "emailNormalized",
          "failureCount",
          "lockedUntil",
          "lastFailedAt",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${randomUUID()},
          ${emailNormalized},
          1,
          NULL,
          NOW(),
          NOW(),
          NOW()
        )
        ON CONFLICT ("emailNormalized")
        DO UPDATE SET
          "failureCount" = "LoginAttempt"."failureCount" + 1,
          "lockedUntil" = CASE
            WHEN "LoginAttempt"."failureCount" + 1 >= ${LOGIN_LOCKOUT_ATTEMPTS}
            THEN NOW() + (${LOGIN_LOCKOUT_TTL_SECONDS} * INTERVAL '1 second')
            ELSE NULL
          END,
          "lastFailedAt" = NOW(),
          "updatedAt" = NOW()
        RETURNING "failureCount", "lockedUntil"
      `;

    const failureCount = attempt?.failureCount ?? 1;
    const locked = failureCount >= LOGIN_LOCKOUT_ATTEMPTS;

    if (locked) {
      return authFailures.loginLocked(LOGIN_LOCKOUT_TTL_SECONDS);
    }

    return authFailures.invalidCredentials();
  }
}

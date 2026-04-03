import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { LOGIN_LOCKOUT_ATTEMPTS, LOGIN_LOCKOUT_TTL_SECONDS } from './auth.constants.js';
import type { LoginResult } from './auth.types.js';

@Injectable()
export class AuthLoginAttemptService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveLock(emailNormalized: string): Promise<LoginResult | null> {
    const [attempt] = await this.prisma.$queryRawUnsafe<{ remainingSeconds: number }[]>(
      `
        SELECT CEIL(EXTRACT(EPOCH FROM ("lockedUntil" - CURRENT_TIMESTAMP)))::int AS "remainingSeconds"
        FROM "LoginAttempt"
        WHERE "emailNormalized" = $1
          AND "lockedUntil" IS NOT NULL
          AND "lockedUntil" > CURRENT_TIMESTAMP
        LIMIT 1
      `,
      emailNormalized,
    );

    if (!attempt) {
      return null;
    }

    return {
      success: false,
      locked: true,
      remainingSeconds: attempt.remainingSeconds,
      error: '로그인 시도가 5회 실패하여 계정이 5분간 잠겼습니다.',
    };
  }

  async clearFailures(emailNormalized: string): Promise<void> {
    await this.prisma.loginAttempt.deleteMany({
      where: { emailNormalized },
    });
  }

  async recordLoginFailure(emailNormalized: string): Promise<LoginResult> {
    const [attempt] = await this.prisma.$queryRawUnsafe<
      { failureCount: number; lockedUntil: Date | null }[]
    >(
      `
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
          $1,
          $2,
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
            THEN NOW() + INTERVAL '${LOGIN_LOCKOUT_TTL_SECONDS} seconds'
            ELSE NULL
          END,
          "lastFailedAt" = NOW(),
          "updatedAt" = NOW()
        RETURNING "failureCount", "lockedUntil"
      `,
      randomUUID(),
      emailNormalized,
    );

    const failureCount = attempt?.failureCount ?? 1;
    const locked = failureCount >= LOGIN_LOCKOUT_ATTEMPTS;

    if (locked) {
      return {
        success: false,
        locked: true,
        remainingSeconds: LOGIN_LOCKOUT_TTL_SECONDS,
        error: '로그인 시도가 5회 실패하여 계정이 5분간 잠겼습니다.',
      };
    }

    return {
      success: false,
      error: '이메일 또는 비밀번호가 올바르지 않습니다.',
    };
  }
}

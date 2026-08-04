import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import {
  getActiveLoginLock,
  recordLoginFailure as recordLoginFailureSql,
} from '../../../generated/prisma/sql.js';
import { LOGIN_FAILURE_LIMIT, LOGIN_LOCKOUT_SECONDS } from '@repo/shared/auth/policy';

export interface ActiveLoginLockRecord {
  remainingSeconds: number | null;
}

export interface LoginFailureRecord {
  failureCount: number | null;
  lockedUntil?: Date | null;
}

@Injectable()
export class LoginAttemptRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveLock(emailNormalized: string): Promise<ActiveLoginLockRecord | null> {
    const [attempt] = await this.prisma.$queryRawTyped(getActiveLoginLock(emailNormalized));
    return attempt ?? null;
  }

  async clearFailures(emailNormalized: string): Promise<void> {
    await this.prisma.loginAttempt.deleteMany({
      where: { emailNormalized },
    });
  }

  async clearFailuresInTransaction(
    tx: Pick<Prisma.TransactionClient, 'loginAttempt'>,
    emailNormalized: string,
  ): Promise<void> {
    await tx.loginAttempt.deleteMany({
      where: { emailNormalized },
    });
  }

  async recordFailure(emailNormalized: string): Promise<LoginFailureRecord | null> {
    const [attempt] = await this.prisma.$queryRawTyped(
      recordLoginFailureSql(
        randomUUID(),
        emailNormalized,
        LOGIN_FAILURE_LIMIT,
        LOGIN_LOCKOUT_SECONDS,
      ),
    );

    return attempt ?? null;
  }
}

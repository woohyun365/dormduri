import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import {
  getActiveLoginLock,
  recordLoginFailure as recordLoginFailureSql,
} from '../../generated/prisma/sql.js';
import { LOGIN_LOCKOUT_ATTEMPTS, LOGIN_LOCKOUT_TTL_SECONDS } from '../auth.constants.js';

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

  async recordFailure(emailNormalized: string): Promise<LoginFailureRecord | null> {
    const [attempt] = await this.prisma.$queryRawTyped(
      recordLoginFailureSql(
        randomUUID(),
        emailNormalized,
        LOGIN_LOCKOUT_ATTEMPTS,
        LOGIN_LOCKOUT_TTL_SECONDS,
      ),
    );

    return attempt ?? null;
  }
}

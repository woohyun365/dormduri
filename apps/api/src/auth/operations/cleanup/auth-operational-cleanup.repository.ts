import { Injectable } from '@nestjs/common';
import {
  pruneExpiredAuthSessions,
  pruneExpiredVerificationCodes,
  pruneOldAuthSecurityEvents,
  pruneOldLoginAttempts,
  pruneOldVerificationCodeRequestLogs,
} from '../../../generated/prisma/sql.js';

export type AuthCleanupPrismaClient = {
  $queryRawTyped<T = unknown>(query: unknown): Promise<T[]>;
};

export interface AuthCleanupBatchInput {
  expiredSessionCutoff: Date;
  verificationCodeCutoff: Date;
  verificationRequestLogCutoff: Date;
  loginAttemptCutoff: Date;
  securityEventCutoff: Date;
  batchSize: number;
}

export interface AuthCleanupBatchResult {
  expiredSessions: number;
  verificationCodes: number;
  verificationRequestLogs: number;
  loginAttempts: number;
  securityEvents: number;
}

@Injectable()
export class AuthOperationalCleanupRepository {
  async pruneBatch(
    prisma: AuthCleanupPrismaClient,
    input: AuthCleanupBatchInput,
  ): Promise<AuthCleanupBatchResult> {
    const batchSize = clampBatchSize(input.batchSize);

    const [expiredSessionResult] = await prisma.$queryRawTyped<pruneExpiredAuthSessions.Result>(
      pruneExpiredAuthSessions(input.expiredSessionCutoff, batchSize),
    );
    const [verificationCodeResult] =
      await prisma.$queryRawTyped<pruneExpiredVerificationCodes.Result>(
        pruneExpiredVerificationCodes(input.verificationCodeCutoff, batchSize),
      );
    const [verificationRequestLogResult] =
      await prisma.$queryRawTyped<pruneOldVerificationCodeRequestLogs.Result>(
        pruneOldVerificationCodeRequestLogs(input.verificationRequestLogCutoff, batchSize),
      );
    const [loginAttemptResult] = await prisma.$queryRawTyped<pruneOldLoginAttempts.Result>(
      pruneOldLoginAttempts(input.loginAttemptCutoff, batchSize),
    );
    const [securityEventResult] = await prisma.$queryRawTyped<pruneOldAuthSecurityEvents.Result>(
      pruneOldAuthSecurityEvents(input.securityEventCutoff, batchSize),
    );

    return {
      expiredSessions: expiredSessionResult?.deletedCount ?? 0,
      verificationCodes: verificationCodeResult?.deletedCount ?? 0,
      verificationRequestLogs: verificationRequestLogResult?.deletedCount ?? 0,
      loginAttempts: loginAttemptResult?.deletedCount ?? 0,
      securityEvents: securityEventResult?.deletedCount ?? 0,
    };
  }
}

function clampBatchSize(batchSize: number) {
  return Math.max(1, Math.min(Math.floor(batchSize), 1_000));
}

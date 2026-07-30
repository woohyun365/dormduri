import { Injectable } from '@nestjs/common';
import type { VerificationCodePurpose } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import {
  acquireTransactionAdvisoryLock,
  getActiveVerificationRecord,
  getVerificationBackstopRetryAfterSeconds,
  getVerificationRetryAfterSeconds,
  recordVerificationCodeFailure,
} from '../../generated/prisma/sql.js';
import {
  getVerificationCodePurposeLockKey,
  VERIFICATION_CODE_PURPOSE_LOCK_NAMESPACE,
} from './auth-verification-lock.js';
import {
  parseVerificationGrant,
  safeCompareVerificationGrantHash,
} from './auth-verification-grant.js';

export interface VerificationRecord {
  id: string;
  codeHash: string;
  failedAttempts: number;
}

export interface ResolvedVerificationGrant {
  id: string;
  emailNormalized: string;
  purpose: VerificationCodePurpose;
  eligibleUserId: string | null;
  tokenHash: string;
  expiresAt: Date;
}

interface VerificationCodeInput {
  id: string;
  emailNormalized: string;
  codeHash: string;
  ttlSeconds: number;
  requestIp: string | null;
}

interface VerificationCodeTransitionInput {
  id: string;
  emailNormalized: string;
  purpose: VerificationCodePurpose;
  maxAttempts: number;
}

export interface VerificationFailureRecordResult {
  recorded: boolean;
  consumed: boolean;
}

@Injectable()
export class AuthVerificationStore {
  constructor(private readonly prisma: PrismaService) {}

  async findRetryAfterSeconds(
    emailNormalized: string,
    purpose: VerificationCodePurpose,
    requestIp: string,
    cooldownSeconds: number,
  ): Promise<number | null> {
    const [latestRequest] = await this.prisma.$queryRawTyped(
      getVerificationRetryAfterSeconds(emailNormalized, purpose, requestIp, cooldownSeconds),
    );

    return latestRequest?.retryAfterSeconds ?? null;
  }

  async findBackstopRetryAfterSeconds(
    emailNormalized: string,
    purpose: VerificationCodePurpose,
    cooldownWindowSeconds: number,
    limit: number,
  ): Promise<number | null> {
    const [recentRequests] = await this.prisma.$queryRawTyped(
      getVerificationBackstopRetryAfterSeconds(emailNormalized, purpose, cooldownWindowSeconds),
    );

    if (
      !recentRequests ||
      recentRequests.requestCount == null ||
      recentRequests.requestCount < limit ||
      !recentRequests.oldestRequestAt
    ) {
      return null;
    }

    const retryAfterSeconds = Math.ceil(
      (recentRequests.oldestRequestAt.getTime() + cooldownWindowSeconds * 1000 - Date.now()) / 1000,
    );

    return retryAfterSeconds > 0 ? retryAfterSeconds : null;
  }

  async createRequestLog(
    emailNormalized: string,
    purpose: VerificationCodePurpose,
    requestIp: string,
  ): Promise<void> {
    await this.prisma.verificationCodeRequestLog.create({
      data: {
        emailNormalized,
        purpose,
        requestIp,
      },
    });
  }

  async invalidateActiveSignupCodes(emailNormalized: string): Promise<void> {
    const consumedAt = await this.prisma.getDatabaseNow();

    await this.prisma.verificationCode.updateMany({
      where: {
        emailNormalized,
        purpose: 'SIGNUP',
        consumedAt: null,
      },
      data: { consumedAt },
    });
  }

  async replaceActiveSignupCode(input: VerificationCodeInput): Promise<void> {
    await this.replaceActiveVerificationCode({ ...input, purpose: 'SIGNUP' });
  }

  async replaceActiveResetCode(input: VerificationCodeInput): Promise<void> {
    await this.replaceActiveVerificationCode({ ...input, purpose: 'RESET_PASSWORD' });
  }

  private async replaceActiveVerificationCode(
    input: VerificationCodeInput & { purpose: VerificationCodePurpose },
  ): Promise<void> {
    const issuedAt = await this.prisma.getDatabaseNow();

    await this.prisma.runSerializableTransaction(async (tx) => {
      await tx.$queryRawTyped(
        acquireTransactionAdvisoryLock(
          VERIFICATION_CODE_PURPOSE_LOCK_NAMESPACE,
          getVerificationCodePurposeLockKey(input.emailNormalized, input.purpose),
        ),
      );

      await tx.verificationCode.updateMany({
        where: {
          emailNormalized: input.emailNormalized,
          purpose: input.purpose,
          consumedAt: null,
        },
        data: { consumedAt: issuedAt },
      });

      await tx.verificationCode.create({
        data: {
          id: input.id,
          emailNormalized: input.emailNormalized,
          purpose: input.purpose,
          codeHash: input.codeHash,
          issuedAt,
          expiresAt: new Date(issuedAt.getTime() + input.ttlSeconds * 1000),
          requestIp: input.requestIp,
        },
      });
    });
  }

  async insertVerificationCode(input: {
    id: string;
    emailNormalized: string;
    purpose: VerificationCodePurpose;
    codeHash: string;
    ttlSeconds: number;
    requestIp: string | null;
  }): Promise<void> {
    const issuedAt = await this.prisma.getDatabaseNow();

    await this.prisma.verificationCode.create({
      data: {
        id: input.id,
        emailNormalized: input.emailNormalized,
        purpose: input.purpose,
        codeHash: input.codeHash,
        expiresAt: new Date(issuedAt.getTime() + input.ttlSeconds * 1000),
        requestIp: input.requestIp,
      },
    });
  }

  async findActiveVerificationRecord(
    emailNormalized: string,
    purpose: VerificationCodePurpose,
    maxAttempts: number,
  ): Promise<VerificationRecord | null> {
    const [record] = await this.prisma.$queryRawTyped(
      getActiveVerificationRecord(emailNormalized, purpose, maxAttempts),
    );

    return record ?? null;
  }

  async markVerifiedAndIssueGrant(
    input: VerificationCodeTransitionInput & {
      grantTokenHash: string;
      grantTtlSeconds: number;
      eligibleUserId: string | null;
    },
  ): Promise<boolean> {
    const verifiedAt = await this.prisma.getDatabaseNow();
    const updated = await this.prisma.runSerializableTransaction(async (tx) => {
      await tx.$queryRawTyped(
        acquireTransactionAdvisoryLock(
          VERIFICATION_CODE_PURPOSE_LOCK_NAMESPACE,
          getVerificationCodePurposeLockKey(input.emailNormalized, input.purpose),
        ),
      );

      return tx.verificationCode.updateMany({
        where: {
          id: input.id,
          purpose: input.purpose,
          emailNormalized: input.emailNormalized,
          verifiedAt: null,
          consumedAt: null,
          expiresAt: { gt: verifiedAt },
          failedAttempts: { lt: input.maxAttempts },
        },
        data: {
          verifiedAt,
          grantTokenHash: input.grantTokenHash,
          grantExpiresAt: new Date(verifiedAt.getTime() + input.grantTtlSeconds * 1000),
          eligibleUserId: input.eligibleUserId,
        },
      });
    });

    return updated.count === 1;
  }

  async resolveVerificationGrant(
    rawGrant: string | null,
    purpose: VerificationCodePurpose,
  ): Promise<ResolvedVerificationGrant | null> {
    const parsed = parseVerificationGrant(rawGrant);
    if (!parsed) {
      return null;
    }

    const [record, databaseNow] = await Promise.all([
      this.prisma.verificationCode.findUnique({
        where: { id: parsed.verificationCodeId },
        select: {
          id: true,
          emailNormalized: true,
          purpose: true,
          eligibleUserId: true,
          grantTokenHash: true,
          grantExpiresAt: true,
          verifiedAt: true,
          consumedAt: true,
        },
      }),
      this.prisma.getDatabaseNow(),
    ]);

    if (
      !record ||
      record.purpose !== purpose ||
      !record.verifiedAt ||
      record.consumedAt ||
      !record.grantTokenHash ||
      !record.grantExpiresAt ||
      record.grantExpiresAt <= databaseNow ||
      !safeCompareVerificationGrantHash(record.grantTokenHash, parsed.tokenHash)
    ) {
      return null;
    }

    return {
      id: record.id,
      emailNormalized: record.emailNormalized,
      purpose: record.purpose,
      eligibleUserId: record.eligibleUserId,
      tokenHash: parsed.tokenHash,
      expiresAt: record.grantExpiresAt,
    };
  }

  async recordVerificationFailure(
    input: VerificationCodeTransitionInput,
  ): Promise<VerificationFailureRecordResult> {
    const rows = await this.prisma.runSerializableTransaction(async (tx) => {
      await tx.$queryRawTyped(
        acquireTransactionAdvisoryLock(
          VERIFICATION_CODE_PURPOSE_LOCK_NAMESPACE,
          getVerificationCodePurposeLockKey(input.emailNormalized, input.purpose),
        ),
      );

      return tx.$queryRawTyped(recordVerificationCodeFailure(input.id, input.maxAttempts));
    });

    const row = rows[0];
    return {
      recorded: Boolean(row),
      consumed: Boolean(row?.consumedAt),
    };
  }
}

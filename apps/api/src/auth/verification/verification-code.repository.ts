import { Injectable } from '@nestjs/common';
import type { VerificationCodePurpose } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import {
  acquireTransactionAdvisoryLock,
  consumeVerificationCodeProof,
  getActiveVerificationRecord,
  getLatestVerifiedResetCode,
  getLatestVerifiedSignupCode,
  getVerificationBackstopRetryAfterSeconds,
  getVerificationRetryAfterSeconds,
  markVerificationCodeVerified,
  recordVerificationCodeFailure,
} from '../../generated/prisma/sql.js';
import {
  getVerificationCodePurposeLockKey,
  VERIFICATION_CODE_PURPOSE_LOCK_NAMESPACE,
} from './auth-verification-lock.js';

export interface VerificationCodeHandle {
  id: string;
}

export interface VerificationRecord {
  id: string;
  codeHash: string;
  failedAttempts: number;
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

  async findLatestVerifiedSignupCode(
    emailNormalized: string,
    proofTtlSeconds: number,
  ): Promise<VerificationCodeHandle | null> {
    const [record] = await this.prisma.$queryRawTyped(
      getLatestVerifiedSignupCode(emailNormalized, proofTtlSeconds),
    );

    return record ?? null;
  }

  async findLatestVerifiedResetCode(
    emailNormalized: string,
  ): Promise<VerificationCodeHandle | null> {
    const [record] = await this.prisma.$queryRawTyped(getLatestVerifiedResetCode(emailNormalized));

    return record ?? null;
  }

  async consumeVerificationCode(id: string): Promise<boolean> {
    const consumedAt = await this.prisma.getDatabaseNow();
    const rows = await this.prisma.$queryRawTyped(consumeVerificationCodeProof(id, consumedAt));

    return rows.length === 1;
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

  async markVerified(input: VerificationCodeTransitionInput): Promise<boolean> {
    const rows = await this.prisma.runSerializableTransaction(async (tx) => {
      await tx.$queryRawTyped(
        acquireTransactionAdvisoryLock(
          VERIFICATION_CODE_PURPOSE_LOCK_NAMESPACE,
          getVerificationCodePurposeLockKey(input.emailNormalized, input.purpose),
        ),
      );

      return tx.$queryRawTyped(markVerificationCodeVerified(input.id, input.maxAttempts));
    });

    return rows.length === 1;
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

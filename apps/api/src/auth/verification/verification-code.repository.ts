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
  subjectKey: string;
  purpose: VerificationCodePurpose;
  eligibleUserId: string | null;
  tokenHash: string;
  expiresAt: Date;
}

interface VerificationCodeInput {
  id: string;
  subjectKey: string;
  codeHash: string;
  ttlSeconds: number;
  requestIpKey: string | null;
}

interface VerificationCodeTransitionInput {
  id: string;
  subjectKey: string;
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
    subjectKey: string,
    purpose: VerificationCodePurpose,
    requestIpKey: string,
    cooldownSeconds: number,
  ): Promise<number | null> {
    const [latestRequest] = await this.prisma.$queryRawTyped(
      getVerificationRetryAfterSeconds(subjectKey, purpose, requestIpKey, cooldownSeconds),
    );

    return latestRequest?.retryAfterSeconds ?? null;
  }

  async findBackstopRetryAfterSeconds(
    subjectKey: string,
    purpose: VerificationCodePurpose,
    cooldownWindowSeconds: number,
    limit: number,
  ): Promise<number | null> {
    const [recentRequests] = await this.prisma.$queryRawTyped(
      getVerificationBackstopRetryAfterSeconds(subjectKey, purpose, cooldownWindowSeconds),
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
    subjectKey: string,
    purpose: VerificationCodePurpose,
    requestIpKey: string,
  ): Promise<void> {
    await this.prisma.verificationCodeRequestLog.create({
      data: {
        subjectKey,
        purpose,
        requestIpKey,
      },
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
          getVerificationCodePurposeLockKey(input.subjectKey, input.purpose),
        ),
      );

      await tx.verificationCode.updateMany({
        where: {
          subjectKey: input.subjectKey,
          purpose: input.purpose,
          consumedAt: null,
        },
        data: { consumedAt: issuedAt },
      });

      await tx.verificationCode.create({
        data: {
          id: input.id,
          subjectKey: input.subjectKey,
          purpose: input.purpose,
          codeHash: input.codeHash,
          issuedAt,
          codeExpiresAt: new Date(issuedAt.getTime() + input.ttlSeconds * 1000),
          requestIpKey: input.requestIpKey,
        },
      });
    });
  }

  async findActiveVerificationRecord(
    subjectKey: string,
    purpose: VerificationCodePurpose,
    maxAttempts: number,
  ): Promise<VerificationRecord | null> {
    const [record] = await this.prisma.$queryRawTyped(
      getActiveVerificationRecord(subjectKey, purpose, maxAttempts),
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
          getVerificationCodePurposeLockKey(input.subjectKey, input.purpose),
        ),
      );

      return tx.verificationCode.updateMany({
        where: {
          id: input.id,
          purpose: input.purpose,
          subjectKey: input.subjectKey,
          verifiedAt: null,
          consumedAt: null,
          deliveryStatus: 'ACCEPTED',
          activatedAt: { not: null },
          codeExpiresAt: { gt: verifiedAt },
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
          subjectKey: true,
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
      subjectKey: record.subjectKey,
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
          getVerificationCodePurposeLockKey(input.subjectKey, input.purpose),
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

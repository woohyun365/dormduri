import { Injectable } from '@nestjs/common';
import type { VerificationCodePurpose } from '../../../generated/prisma/enums.js';
import {
  acquireTransactionAdvisoryLock,
  getActiveVerificationRecord,
  recordVerificationCodeFailure,
} from '../../../generated/prisma/sql.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import {
  getVerificationCodePurposeLockKey,
  VERIFICATION_CODE_PURPOSE_LOCK_NAMESPACE,
} from '../grant/auth-verification-lock.js';

export interface VerificationRecord {
  id: string;
  codeHash: string;
  failedAttempts: number;
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
export class AuthVerificationChallengeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActive(
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

  async recordFailure(
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

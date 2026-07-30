import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AuthMailKind, VerificationCodePurpose } from '../../generated/prisma/enums.js';
import {
  acquireTransactionAdvisoryLock,
  getVerificationBackstopRetryAfterSeconds,
  getVerificationRetryAfterSeconds,
} from '../../generated/prisma/sql.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import {
  getVerificationCodePurposeLockKey,
  VERIFICATION_CODE_PURPOSE_LOCK_NAMESPACE,
} from './auth-verification-lock.js';

export interface PendingVerificationRequestInput {
  id: string;
  subjectKey: string;
  codeHash: string;
  ttlSeconds: number;
  requestIpKey: string | null;
  emailEnvelope: {
    payloadCiphertext: Buffer;
    payloadIv: Buffer;
    payloadAuthTag: Buffer;
    keyVersion: string;
  };
}

export class VerificationRequestThrottledError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('[AuthVerificationRequestRepository] verification request throttled');
    this.name = 'VerificationRequestThrottledError';
  }
}

@Injectable()
export class AuthVerificationRequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async append(input: {
    subjectKey: string;
    purpose: VerificationCodePurpose;
    requestIpKey: string;
    cooldownSeconds: number;
    backstopWindowSeconds: number;
    backstopLimit: number;
    candidate: PendingVerificationRequestInput | null;
    securityEvent: Prisma.AuthSecurityEventCreateInput | null;
  }): Promise<void> {
    const issuedAt = await this.prisma.getDatabaseNow();

    await this.prisma.runSerializableTransaction(async (tx) => {
      await tx.$queryRawTyped(
        acquireTransactionAdvisoryLock(
          VERIFICATION_CODE_PURPOSE_LOCK_NAMESPACE,
          getVerificationCodePurposeLockKey(input.subjectKey, input.purpose),
        ),
      );

      const retryAfterSeconds = await this.findRetryAfterSecondsInTransaction(tx, input, issuedAt);
      if (retryAfterSeconds) {
        throw new VerificationRequestThrottledError(retryAfterSeconds);
      }

      await tx.verificationCodeRequestLog.create({
        data: {
          subjectKey: input.subjectKey,
          purpose: input.purpose,
          requestIpKey: input.requestIpKey,
          createdAt: issuedAt,
        },
      });

      if (input.securityEvent) {
        await tx.authSecurityEvent.create({ data: input.securityEvent });
      }

      if (!input.candidate) {
        return;
      }

      await this.supersedePendingCandidates(tx, input.subjectKey, input.purpose, issuedAt);

      const codeExpiresAt = new Date(issuedAt.getTime() + input.candidate.ttlSeconds * 1_000);
      await tx.verificationCode.create({
        data: {
          id: input.candidate.id,
          subjectKey: input.subjectKey,
          purpose: input.purpose,
          codeHash: input.candidate.codeHash,
          deliveryStatus: 'PENDING',
          issuedAt,
          codeExpiresAt,
          activatedAt: null,
          requestIpKey: input.candidate.requestIpKey,
          mailEvents: {
            create: {
              mailKind: toVerificationMailKind(input.purpose),
              purpose: input.purpose,
              payloadCiphertext: toPrismaBytes(input.candidate.emailEnvelope.payloadCiphertext),
              payloadIv: toPrismaBytes(input.candidate.emailEnvelope.payloadIv),
              payloadAuthTag: toPrismaBytes(input.candidate.emailEnvelope.payloadAuthTag),
              keyVersion: input.candidate.emailEnvelope.keyVersion,
              expiresAt: codeExpiresAt,
            },
          },
        },
      });
    });
  }

  private async findRetryAfterSecondsInTransaction(
    tx: Prisma.TransactionClient,
    input: {
      subjectKey: string;
      purpose: VerificationCodePurpose;
      requestIpKey: string;
      cooldownSeconds: number;
      backstopWindowSeconds: number;
      backstopLimit: number;
    },
    now: Date,
  ): Promise<number | null> {
    const [[latestRequest], [recentRequests]] = await Promise.all([
      tx.$queryRawTyped(
        getVerificationRetryAfterSeconds(
          input.subjectKey,
          input.purpose,
          input.requestIpKey,
          input.cooldownSeconds,
        ),
      ),
      tx.$queryRawTyped(
        getVerificationBackstopRetryAfterSeconds(
          input.subjectKey,
          input.purpose,
          input.backstopWindowSeconds,
        ),
      ),
    ]);
    const backstopRetryAfterSeconds =
      recentRequests?.requestCount != null &&
      recentRequests.requestCount >= input.backstopLimit &&
      recentRequests.oldestRequestAt
        ? Math.ceil(
            (recentRequests.oldestRequestAt.getTime() +
              input.backstopWindowSeconds * 1_000 -
              now.getTime()) /
              1_000,
          )
        : null;
    const candidates = [latestRequest?.retryAfterSeconds, backstopRetryAfterSeconds].filter(
      (value): value is number => typeof value === 'number' && value > 0,
    );
    return candidates.length > 0 ? Math.max(...candidates) : null;
  }

  private async supersedePendingCandidates(
    tx: Prisma.TransactionClient,
    subjectKey: string,
    purpose: VerificationCodePurpose,
    now: Date,
  ): Promise<void> {
    const pending = await tx.verificationCode.findMany({
      where: {
        subjectKey,
        purpose,
        deliveryStatus: 'PENDING',
        consumedAt: null,
      },
      select: { id: true },
    });
    const pendingIds = pending.map((record) => record.id);
    if (pendingIds.length === 0) {
      return;
    }

    await tx.authMailOutboxEvent.updateMany({
      where: {
        verificationCodeId: { in: pendingIds },
        status: { in: ['PENDING', 'PROCESSING'] },
      },
      data: {
        status: 'SUPERSEDED',
        payloadCiphertext: null,
        payloadIv: null,
        payloadAuthTag: null,
        lockedAt: null,
        lockedBy: null,
        completedAt: now,
      },
    });
    await tx.verificationCode.updateMany({
      where: { id: { in: pendingIds }, deliveryStatus: 'PENDING' },
      data: {
        deliveryStatus: 'SUPERSEDED',
        consumedAt: now,
      },
    });
  }
}

function toVerificationMailKind(purpose: VerificationCodePurpose): AuthMailKind {
  return purpose === 'SIGNUP' ? 'SIGNUP_VERIFICATION' : 'PASSWORD_RESET_VERIFICATION';
}

function toPrismaBytes(input: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(input.byteLength);
  copy.set(input);
  return copy;
}

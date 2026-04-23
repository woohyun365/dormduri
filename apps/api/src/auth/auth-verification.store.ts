import { Injectable } from '@nestjs/common';
import type { VerificationCodePurpose } from '../generated/prisma/enums.js';
import { PrismaService } from '../common/prisma/prisma.service.js';

export interface VerificationCodeHandle {
  id: string;
}

export interface VerificationRecord {
  id: string;
  codeHash: string;
  failedAttempts: number;
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
    const [latestRequest] = await this.prisma.$queryRaw<{ retryAfterSeconds: number }[]>`
        SELECT CEIL(EXTRACT(EPOCH FROM ("createdAt" + (${cooldownSeconds} * INTERVAL '1 second') - CURRENT_TIMESTAMP)))::int AS "retryAfterSeconds"
        FROM "VerificationCodeRequestLog"
        WHERE "emailNormalized" = ${emailNormalized}
          AND purpose = CAST(${purpose} AS "VerificationCodePurpose")
          AND "requestIp" = ${requestIp}
          AND "createdAt" > CURRENT_TIMESTAMP - (${cooldownSeconds} * INTERVAL '1 second')
        ORDER BY "createdAt" DESC
        LIMIT 1
      `;

    return latestRequest?.retryAfterSeconds ?? null;
  }

  async findBackstopRetryAfterSeconds(
    emailNormalized: string,
    purpose: VerificationCodePurpose,
    cooldownWindowSeconds: number,
    limit: number,
  ): Promise<number | null> {
    const [recentRequests] = await this.prisma.$queryRaw<
      { requestCount: number; oldestRequestAt: Date | null }[]
    >`
        SELECT
          COUNT(*)::int AS "requestCount",
          MIN("createdAt") AS "oldestRequestAt"
        FROM "VerificationCodeRequestLog"
        WHERE "emailNormalized" = ${emailNormalized}
          AND purpose = CAST(${purpose} AS "VerificationCodePurpose")
          AND "createdAt" > CURRENT_TIMESTAMP - (${cooldownWindowSeconds} * INTERVAL '1 second')
      `;

    if (!recentRequests || recentRequests.requestCount < limit || !recentRequests.oldestRequestAt) {
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
    const [record] = await this.prisma.$queryRaw<VerificationCodeHandle[]>`
        SELECT id
        FROM "VerificationCode"
        WHERE "emailNormalized" = ${emailNormalized}
          AND purpose = 'SIGNUP'::"VerificationCodePurpose"
          AND "verifiedAt" IS NOT NULL
          AND "verifiedAt" > CURRENT_TIMESTAMP - (${proofTtlSeconds} * INTERVAL '1 second')
          AND "consumedAt" IS NULL
        ORDER BY "issuedAt" DESC
        LIMIT 1
      `;

    return record ?? null;
  }

  async findLatestVerifiedResetCode(
    emailNormalized: string,
  ): Promise<VerificationCodeHandle | null> {
    const [record] = await this.prisma.$queryRaw<VerificationCodeHandle[]>`
        SELECT id
        FROM "VerificationCode"
        WHERE "emailNormalized" = ${emailNormalized}
          AND purpose = 'RESET_PASSWORD'::"VerificationCodePurpose"
          AND "verifiedAt" IS NOT NULL
          AND "consumedAt" IS NULL
          AND "expiresAt" > CURRENT_TIMESTAMP
        ORDER BY "issuedAt" DESC
        LIMIT 1
      `;

    return record ?? null;
  }

  async consumeVerificationCode(id: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "VerificationCode"
      SET "consumedAt" = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;
  }

  async invalidateActiveSignupCodes(emailNormalized: string): Promise<void> {
    await this.prisma.$executeRaw`
        UPDATE "VerificationCode"
        SET "consumedAt" = CURRENT_TIMESTAMP
        WHERE "emailNormalized" = ${emailNormalized}
          AND purpose = 'SIGNUP'::"VerificationCodePurpose"
          AND "consumedAt" IS NULL
      `;
  }

  async insertVerificationCode(input: {
    id: string;
    emailNormalized: string;
    purpose: VerificationCodePurpose;
    codeHash: string;
    ttlSeconds: number;
    requestIp: string | null;
  }): Promise<void> {
    await this.prisma.$executeRaw`
        INSERT INTO "VerificationCode" (
          id,
          "emailNormalized",
          purpose,
          "codeHash",
          "expiresAt",
          "requestIp"
        )
        VALUES (
          ${input.id},
          ${input.emailNormalized},
          CAST(${input.purpose} AS "VerificationCodePurpose"),
          ${input.codeHash},
          CURRENT_TIMESTAMP + (${input.ttlSeconds} * INTERVAL '1 second'),
          ${input.requestIp}
        )
      `;
  }

  async findActiveVerificationRecord(
    emailNormalized: string,
    purpose: VerificationCodePurpose,
    maxAttempts: number,
  ): Promise<VerificationRecord | null> {
    const [record] = await this.prisma.$queryRaw<VerificationRecord[]>`
        SELECT id, "codeHash", "failedAttempts"
        FROM "VerificationCode"
        WHERE "emailNormalized" = ${emailNormalized}
          AND purpose = CAST(${purpose} AS "VerificationCodePurpose")
          AND "consumedAt" IS NULL
          AND "expiresAt" > CURRENT_TIMESTAMP
          AND "failedAttempts" < ${maxAttempts}
        ORDER BY "issuedAt" DESC
        LIMIT 1
      `;

    return record ?? null;
  }

  async markVerified(id: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "VerificationCode"
      SET "verifiedAt" = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;
  }

  async incrementFailedAttempts(id: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "VerificationCode"
      SET "failedAttempts" = "failedAttempts" + 1
      WHERE id = ${id}
    `;
  }

  async failAndConsume(id: string): Promise<void> {
    await this.prisma.$executeRaw`
        UPDATE "VerificationCode"
        SET "failedAttempts" = "failedAttempts" + 1,
            "consumedAt" = CURRENT_TIMESTAMP
        WHERE id = ${id}
      `;
  }
}

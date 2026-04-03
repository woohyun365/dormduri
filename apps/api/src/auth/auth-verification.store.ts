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
    const [latestRequest] = await this.prisma.$queryRawUnsafe<{ retryAfterSeconds: number }[]>(
      `
        SELECT CEIL(EXTRACT(EPOCH FROM ("createdAt" + INTERVAL '${cooldownSeconds} seconds' - CURRENT_TIMESTAMP)))::int AS "retryAfterSeconds"
        FROM "VerificationCodeRequestLog"
        WHERE "emailNormalized" = $1
          AND purpose = $2::"VerificationCodePurpose"
          AND "requestIp" = $3
          AND "createdAt" > CURRENT_TIMESTAMP - INTERVAL '${cooldownSeconds} seconds'
        ORDER BY "createdAt" DESC
        LIMIT 1
      `,
      emailNormalized,
      purpose,
      requestIp,
    );

    return latestRequest?.retryAfterSeconds ?? null;
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
    const [record] = await this.prisma.$queryRawUnsafe<VerificationCodeHandle[]>(
      `
        SELECT id
        FROM "VerificationCode"
        WHERE "emailNormalized" = $1
          AND purpose = 'SIGNUP'::"VerificationCodePurpose"
          AND "verifiedAt" IS NOT NULL
          AND "verifiedAt" > CURRENT_TIMESTAMP - INTERVAL '${proofTtlSeconds} seconds'
          AND "consumedAt" IS NULL
        ORDER BY "issuedAt" DESC
        LIMIT 1
      `,
      emailNormalized,
    );

    return record ?? null;
  }

  async findLatestVerifiedResetCode(
    emailNormalized: string,
  ): Promise<VerificationCodeHandle | null> {
    const [record] = await this.prisma.$queryRawUnsafe<VerificationCodeHandle[]>(
      `
        SELECT id
        FROM "VerificationCode"
        WHERE "emailNormalized" = $1
          AND purpose = 'RESET_PASSWORD'::"VerificationCodePurpose"
          AND "verifiedAt" IS NOT NULL
          AND "consumedAt" IS NULL
          AND "expiresAt" > CURRENT_TIMESTAMP
        ORDER BY "issuedAt" DESC
        LIMIT 1
      `,
      emailNormalized,
    );

    return record ?? null;
  }

  async consumeVerificationCode(id: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `UPDATE "VerificationCode" SET "consumedAt" = CURRENT_TIMESTAMP WHERE id = $1`,
      id,
    );
  }

  async invalidateActiveSignupCodes(emailNormalized: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `
        UPDATE "VerificationCode"
        SET "consumedAt" = CURRENT_TIMESTAMP
        WHERE "emailNormalized" = $1
          AND purpose = 'SIGNUP'::"VerificationCodePurpose"
          AND "consumedAt" IS NULL
      `,
      emailNormalized,
    );
  }

  async insertVerificationCode(input: {
    id: string;
    emailNormalized: string;
    purpose: VerificationCodePurpose;
    codeHash: string;
    ttlSeconds: number;
    requestIp: string | null;
  }): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `
        INSERT INTO "VerificationCode" (
          id,
          "emailNormalized",
          purpose,
          "codeHash",
          "expiresAt",
          "requestIp"
        )
        VALUES (
          $1,
          $2,
          $3::"VerificationCodePurpose",
          $4,
          CURRENT_TIMESTAMP + INTERVAL '${input.ttlSeconds} seconds',
          $5
        )
      `,
      input.id,
      input.emailNormalized,
      input.purpose,
      input.codeHash,
      input.requestIp,
    );
  }

  async findActiveVerificationRecord(
    emailNormalized: string,
    purpose: VerificationCodePurpose,
    maxAttempts: number,
  ): Promise<VerificationRecord | null> {
    const [record] = await this.prisma.$queryRawUnsafe<VerificationRecord[]>(
      `
        SELECT id, "codeHash", "failedAttempts"
        FROM "VerificationCode"
        WHERE "emailNormalized" = $1
          AND purpose = $2::"VerificationCodePurpose"
          AND "consumedAt" IS NULL
          AND "expiresAt" > CURRENT_TIMESTAMP
          AND "failedAttempts" < $3
        ORDER BY "issuedAt" DESC
        LIMIT 1
      `,
      emailNormalized,
      purpose,
      maxAttempts,
    );

    return record ?? null;
  }

  async markVerified(id: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `UPDATE "VerificationCode" SET "verifiedAt" = CURRENT_TIMESTAMP WHERE id = $1`,
      id,
    );
  }

  async incrementFailedAttempts(id: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `UPDATE "VerificationCode" SET "failedAttempts" = "failedAttempts" + 1 WHERE id = $1`,
      id,
    );
  }

  async failAndConsume(id: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `
        UPDATE "VerificationCode"
        SET "failedAttempts" = "failedAttempts" + 1,
            "consumedAt" = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      id,
    );
  }
}

import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { VerificationCodePurpose } from '../generated/prisma/enums.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import {
  CODE_REQUEST_MIN_RESPONSE_MS,
  RESET_PASSWORD_VERIFICATION_CODE_TTL_SECONDS,
  SIGNUP_VERIFICATION_CODE_TTL_SECONDS,
  SIGNUP_VERIFIED_PROOF_TTL_SECONDS,
  VERIFICATION_CODE_MAX_ATTEMPTS,
} from './auth.constants.js';
import { EMAIL_SENDER } from './email-sender.interface.js';
import type { EmailSender } from './email-sender.interface.js';
import type { GenericSuccessResult } from './auth.types.js';
import {
  ensureMinDuration,
  generateVerificationCode,
  hashVerificationCode,
  normalizeEmail,
} from './auth.utils.js';
import { apiEnv } from '../config/env.js';

interface VerificationCodeHandle {
  id: string;
}

interface VerificationRecord {
  id: string;
  codeHash: string;
  failedAttempts: number;
}

@Injectable()
export class AuthVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
  ) {}

  async assertCodeRequestAllowed(
    emailNormalized: string,
    purpose: VerificationCodePurpose,
    requestIp: string | null,
  ): Promise<void> {
    const normalizedIp = this.normalizeRequestIp(requestIp);
    const [latestRequest] = await this.prisma.$queryRawUnsafe<{ retryAfterSeconds: number }[]>(
      `
        SELECT CEIL(EXTRACT(EPOCH FROM ("createdAt" + INTERVAL '${apiEnv.codeRequestCooldownSeconds} seconds' - CURRENT_TIMESTAMP)))::int AS "retryAfterSeconds"
        FROM "VerificationCodeRequestLog"
        WHERE "emailNormalized" = $1
          AND purpose = $2::"VerificationCodePurpose"
          AND "requestIp" = $3
          AND "createdAt" > CURRENT_TIMESTAMP - INTERVAL '${apiEnv.codeRequestCooldownSeconds} seconds'
        ORDER BY "createdAt" DESC
        LIMIT 1
      `,
      emailNormalized,
      purpose,
      normalizedIp,
    );

    if (!latestRequest || latestRequest.retryAfterSeconds <= 0) {
      return;
    }

    throw new HttpException(
      {
        success: false,
        error: `너무 잦은 요청이에요. ${latestRequest.retryAfterSeconds}초 후 다시 시도해주세요.`,
        retryAfterSeconds: latestRequest.retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  async recordCodeRequest(
    emailNormalized: string,
    purpose: VerificationCodePurpose,
    requestIp: string | null,
  ): Promise<void> {
    await this.prisma.verificationCodeRequestLog.create({
      data: {
        emailNormalized,
        purpose,
        requestIp: this.normalizeRequestIp(requestIp),
      },
    });
  }

  async maybeSendSignupCode(
    emailNormalized: string,
    userExists: boolean,
    requestIp: string | null,
  ): Promise<GenericSuccessResult> {
    const startedAt = Date.now();
    await this.assertCodeRequestAllowed(emailNormalized, 'SIGNUP', requestIp);

    if (!userExists) {
      await this.issueVerificationCode(emailNormalized, 'SIGNUP', requestIp);
    }

    await this.recordCodeRequest(emailNormalized, 'SIGNUP', requestIp);
    await ensureMinDuration(startedAt, CODE_REQUEST_MIN_RESPONSE_MS);
    return { success: true };
  }

  async maybeSendResetCode(
    emailNormalized: string,
    userExists: boolean,
    requestIp: string | null,
  ): Promise<GenericSuccessResult> {
    const startedAt = Date.now();
    await this.assertCodeRequestAllowed(emailNormalized, 'RESET_PASSWORD', requestIp);

    if (userExists) {
      await this.issueVerificationCode(emailNormalized, 'RESET_PASSWORD', requestIp);
    }

    await this.recordCodeRequest(emailNormalized, 'RESET_PASSWORD', requestIp);
    await ensureMinDuration(startedAt, CODE_REQUEST_MIN_RESPONSE_MS);
    return { success: true };
  }

  async verifyEmailCode(email: string, code: string): Promise<GenericSuccessResult> {
    return this.verifyCode(email, 'SIGNUP', code);
  }

  async verifyResetCode(email: string, code: string): Promise<GenericSuccessResult> {
    return this.verifyCode(email, 'RESET_PASSWORD', code);
  }

  async findLatestVerifiedSignupCode(
    emailNormalized: string,
  ): Promise<VerificationCodeHandle | null> {
    const [record] = await this.prisma.$queryRawUnsafe<VerificationCodeHandle[]>(
      `
        SELECT id
        FROM "VerificationCode"
        WHERE "emailNormalized" = $1
          AND purpose = 'SIGNUP'::"VerificationCodePurpose"
          AND "verifiedAt" IS NOT NULL
          AND "verifiedAt" > CURRENT_TIMESTAMP - INTERVAL '${SIGNUP_VERIFIED_PROOF_TTL_SECONDS} seconds'
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

  private async issueVerificationCode(
    emailNormalized: string,
    purpose: VerificationCodePurpose,
    requestIp: string | null,
  ): Promise<void> {
    const ttlSeconds =
      purpose === 'SIGNUP'
        ? SIGNUP_VERIFICATION_CODE_TTL_SECONDS
        : RESET_PASSWORD_VERIFICATION_CODE_TTL_SECONDS;
    const code = generateVerificationCode();
    const codeHash = hashVerificationCode(emailNormalized, purpose, code);

    if (purpose === 'SIGNUP') {
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
          CURRENT_TIMESTAMP + INTERVAL '${ttlSeconds} seconds',
          $5
        )
      `,
      randomUUID(),
      emailNormalized,
      purpose,
      codeHash,
      requestIp,
    );

    if (purpose === 'SIGNUP') {
      await this.emailSender.sendVerificationCode({
        email: emailNormalized,
        code,
        expiresInSeconds: ttlSeconds,
      });
      return;
    }

    await this.emailSender.sendPasswordResetCode({
      email: emailNormalized,
      code,
      expiresInSeconds: ttlSeconds,
    });
  }

  private normalizeRequestIp(requestIp: string | null): string {
    return requestIp?.trim() || 'unknown';
  }

  private async verifyCode(
    email: string,
    purpose: VerificationCodePurpose,
    code: string,
  ): Promise<GenericSuccessResult> {
    const emailNormalized = normalizeEmail(email);
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
      VERIFICATION_CODE_MAX_ATTEMPTS,
    );

    if (!record) {
      return { success: false, error: '인증 코드가 올바르지 않습니다.' };
    }

    const incomingHash = hashVerificationCode(emailNormalized, purpose, code);
    if (incomingHash !== record.codeHash) {
      await this.handleFailedVerification(record);
      return { success: false, error: '인증 코드가 올바르지 않습니다.' };
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE "VerificationCode" SET "verifiedAt" = CURRENT_TIMESTAMP WHERE id = $1`,
      record.id,
    );

    return { success: true };
  }

  private async handleFailedVerification(record: VerificationRecord): Promise<void> {
    if (record.failedAttempts + 1 >= VERIFICATION_CODE_MAX_ATTEMPTS) {
      await this.prisma.$executeRawUnsafe(
        `
          UPDATE "VerificationCode"
          SET "failedAttempts" = "failedAttempts" + 1,
              "consumedAt" = CURRENT_TIMESTAMP
          WHERE id = $1
        `,
        record.id,
      );
      return;
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE "VerificationCode" SET "failedAttempts" = "failedAttempts" + 1 WHERE id = $1`,
      record.id,
    );
  }
}

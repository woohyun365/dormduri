import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { VerificationCodePurpose } from '../generated/prisma/enums.js';
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
import { AuthVerificationStore } from './auth-verification.store.js';
import { authErrors } from './auth.errors.js';
import { authFailures } from './auth-failures.js';

@Injectable()
export class AuthVerificationService {
  constructor(
    private readonly verificationStore: AuthVerificationStore,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
  ) {}

  async assertCodeRequestAllowed(
    emailNormalized: string,
    purpose: VerificationCodePurpose,
    requestIp: string | null,
  ): Promise<void> {
    const normalizedIp = this.normalizeRequestIp(requestIp);
    const ipRetryAfterSeconds = await this.verificationStore.findRetryAfterSeconds(
      emailNormalized,
      purpose,
      normalizedIp,
      apiEnv.codeRequestCooldownSeconds,
    );

    const backstopRetryAfterSeconds = await this.verificationStore.findBackstopRetryAfterSeconds(
      emailNormalized,
      purpose,
      apiEnv.codeRequestBackstopWindowSeconds,
      apiEnv.codeRequestBackstopLimit,
    );

    const retryAfterSeconds = [ipRetryAfterSeconds, backstopRetryAfterSeconds]
      .filter((value): value is number => typeof value === 'number' && value > 0)
      .reduce<number | null>((max, value) => (max === null ? value : Math.max(max, value)), null);

    if (!retryAfterSeconds) {
      return;
    }

    throw authErrors.codeRequestThrottled(retryAfterSeconds);
  }

  async recordCodeRequest(
    emailNormalized: string,
    purpose: VerificationCodePurpose,
    requestIp: string | null,
  ): Promise<void> {
    await this.verificationStore.createRequestLog(
      emailNormalized,
      purpose,
      this.normalizeRequestIp(requestIp),
    );
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

  async findLatestVerifiedSignupCode(emailNormalized: string) {
    return this.verificationStore.findLatestVerifiedSignupCode(
      emailNormalized,
      SIGNUP_VERIFIED_PROOF_TTL_SECONDS,
    );
  }

  async findLatestVerifiedResetCode(emailNormalized: string) {
    return this.verificationStore.findLatestVerifiedResetCode(emailNormalized);
  }

  async consumeVerificationCode(id: string): Promise<void> {
    await this.verificationStore.consumeVerificationCode(id);
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
      await this.verificationStore.invalidateActiveSignupCodes(emailNormalized);
    }

    await this.verificationStore.insertVerificationCode({
      id: randomUUID(),
      emailNormalized,
      purpose,
      codeHash,
      ttlSeconds,
      requestIp,
    });

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
    const record = await this.verificationStore.findActiveVerificationRecord(
      emailNormalized,
      purpose,
      VERIFICATION_CODE_MAX_ATTEMPTS,
    );

    if (!record) {
      return authFailures.verificationCodeInvalid();
    }

    const incomingHash = hashVerificationCode(emailNormalized, purpose, code);
    if (incomingHash !== record.codeHash) {
      await this.handleFailedVerification(record.id, record.failedAttempts);
      return authFailures.verificationCodeInvalid();
    }

    await this.verificationStore.markVerified(record.id);
    return { success: true };
  }

  private async handleFailedVerification(id: string, failedAttempts: number): Promise<void> {
    if (failedAttempts + 1 >= VERIFICATION_CODE_MAX_ATTEMPTS) {
      await this.verificationStore.failAndConsume(id);
      return;
    }

    await this.verificationStore.incrementFailedAttempts(id);
  }
}

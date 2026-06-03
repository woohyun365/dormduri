import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
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
  safeTimeEquals,
} from './auth.utils.js';
import authConfig from '../config/auth.config.js';
import { AuthVerificationStore } from './auth-verification.store.js';
import { authErrors } from './auth.errors.js';
import { authFailures } from './auth-failures.js';

const VERIFICATION_CODE_TTL_BY_PURPOSE = {
  SIGNUP: SIGNUP_VERIFICATION_CODE_TTL_SECONDS,
  RESET_PASSWORD: RESET_PASSWORD_VERIFICATION_CODE_TTL_SECONDS,
} as const satisfies Record<VerificationCodePurpose, number>;

@Injectable()
export class AuthVerificationService {
  constructor(
    private readonly verificationStore: AuthVerificationStore,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
    @Inject(authConfig.KEY)
    private readonly authSettings: ConfigType<typeof authConfig>,
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
      this.authSettings.codeRequestCooldownSeconds,
    );

    const backstopRetryAfterSeconds = await this.verificationStore.findBackstopRetryAfterSeconds(
      emailNormalized,
      purpose,
      this.authSettings.codeRequestBackstopWindowSeconds,
      this.authSettings.codeRequestBackstopLimit,
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
    return this.maybeSendCode('SIGNUP', emailNormalized, userExists, requestIp);
  }

  async maybeSendResetCode(
    emailNormalized: string,
    userExists: boolean,
    requestIp: string | null,
  ): Promise<GenericSuccessResult> {
    return this.maybeSendCode('RESET_PASSWORD', emailNormalized, userExists, requestIp);
  }

  private async maybeSendCode(
    purpose: VerificationCodePurpose,
    emailNormalized: string,
    userExists: boolean,
    requestIp: string | null,
  ): Promise<GenericSuccessResult> {
    const startedAt = Date.now();
    await this.assertCodeRequestAllowed(emailNormalized, purpose, requestIp);

    if (this.shouldIssueVerificationCode(purpose, userExists)) {
      await this.issueVerificationCode(emailNormalized, purpose, requestIp);
    }

    await this.recordCodeRequest(emailNormalized, purpose, requestIp);
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
    const ttlSeconds = VERIFICATION_CODE_TTL_BY_PURPOSE[purpose];
    const code = generateVerificationCode();
    const codeHash = hashVerificationCode(
      emailNormalized,
      purpose,
      code,
      this.authSettings.verificationCodeHmacSecret,
    );

    await this.persistVerificationCode({
      purpose,
      emailNormalized,
      codeHash,
      ttlSeconds,
      requestIp,
    });

    await this.sendVerificationEmail({
      purpose,
      email: emailNormalized,
      code,
      expiresInSeconds: ttlSeconds,
    });
  }

  private shouldIssueVerificationCode(
    purpose: VerificationCodePurpose,
    userExists: boolean,
  ): boolean {
    return purpose === 'SIGNUP' ? !userExists : userExists;
  }

  private async persistVerificationCode(input: {
    purpose: VerificationCodePurpose;
    emailNormalized: string;
    codeHash: string;
    ttlSeconds: number;
    requestIp: string | null;
  }) {
    if (input.purpose === 'SIGNUP') {
      await this.verificationStore.replaceActiveSignupCode({
        id: randomUUID(),
        emailNormalized: input.emailNormalized,
        codeHash: input.codeHash,
        ttlSeconds: input.ttlSeconds,
        requestIp: input.requestIp,
      });
      return;
    }

    await this.verificationStore.replaceActiveResetCode({
      id: randomUUID(),
      emailNormalized: input.emailNormalized,
      codeHash: input.codeHash,
      ttlSeconds: input.ttlSeconds,
      requestIp: input.requestIp,
    });
  }

  private async sendVerificationEmail(input: {
    purpose: VerificationCodePurpose;
    email: string;
    code: string;
    expiresInSeconds: number;
  }) {
    if (input.purpose === 'SIGNUP') {
      await this.emailSender.sendVerificationCode({
        email: input.email,
        code: input.code,
        expiresInSeconds: input.expiresInSeconds,
      });
      return;
    }

    await this.emailSender.sendPasswordResetCode({
      email: input.email,
      code: input.code,
      expiresInSeconds: input.expiresInSeconds,
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

    const incomingHash = hashVerificationCode(
      emailNormalized,
      purpose,
      code,
      this.authSettings.verificationCodeHmacSecret,
    );
    const codeMatches = safeTimeEquals(record.codeHash, incomingHash);

    if (!codeMatches) {
      await this.handleFailedVerification(record.id, emailNormalized, purpose);
      return authFailures.verificationCodeInvalid();
    }

    const verified = await this.verificationStore.markVerified({
      id: record.id,
      emailNormalized,
      purpose,
      maxAttempts: VERIFICATION_CODE_MAX_ATTEMPTS,
    });
    if (!verified) {
      return authFailures.verificationCodeInvalid();
    }

    return { success: true };
  }

  private async handleFailedVerification(
    id: string,
    emailNormalized: string,
    purpose: VerificationCodePurpose,
  ): Promise<void> {
    await this.verificationStore.recordVerificationFailure({
      id,
      emailNormalized,
      purpose,
      maxAttempts: VERIFICATION_CODE_MAX_ATTEMPTS,
    });
  }
}

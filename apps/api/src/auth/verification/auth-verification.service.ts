import { Inject, Injectable, Optional } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { VerificationCodePurpose } from '../../generated/prisma/enums.js';
import {
  CODE_REQUEST_MIN_RESPONSE_MS,
  AUTH_VERIFICATION_GRANT_TTL_SECONDS,
  RESET_PASSWORD_VERIFICATION_CODE_TTL_SECONDS,
  SIGNUP_VERIFICATION_CODE_TTL_SECONDS,
  VERIFICATION_CODE_MAX_ATTEMPTS,
} from '../domain/auth.constants.js';
import { EMAIL_SENDER } from '../adapters/email/email-sender.interface.js';
import type { EmailSender } from '../adapters/email/email-sender.interface.js';
import type { GenericSuccessResult, VerificationGrantIssueResult } from '../domain/auth.types.js';
import {
  ensureMinDuration,
  generateVerificationCode,
  hashVerificationCode,
  normalizeEmail,
  safeTimeEquals,
} from '../domain/auth.utils.js';
import authConfig from '../../config/auth.config.js';
import { AuthVerificationStore } from './verification-code.repository.js';
import { authErrors } from '../errors/auth.errors.js';
import { authFailures } from '../errors/auth-failures.js';
import type { AuthRequestContext } from '../domain/auth-request-context.js';
import {
  AuthSecurityEventService,
  recordAuthSecurityEventSafely,
} from '../security-events/auth-security-event.service.js';
import { AUTH_SECURITY_EVENT_METRICS } from '../security-events/auth-security-event.types.js';
import { createVerificationGrant, hashVerificationGrant } from './auth-verification-grant.js';
import type { ResolvedVerificationGrant } from './verification-code.repository.js';

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
    @Optional() private readonly securityEvents?: AuthSecurityEventService,
  ) {}

  async assertCodeRequestAllowed(
    emailNormalized: string,
    purpose: VerificationCodePurpose,
    requestIpOrContext: string | null | AuthRequestContext,
  ): Promise<void> {
    const requestContext = this.normalizeRequestContext(requestIpOrContext);
    const normalizedIp = this.normalizeRequestIp(requestContext.requestIp ?? null);
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
    requestIpOrContext: string | null | AuthRequestContext,
  ): Promise<void> {
    const requestContext = this.normalizeRequestContext(requestIpOrContext);
    await this.verificationStore.createRequestLog(
      emailNormalized,
      purpose,
      this.normalizeRequestIp(requestContext.requestIp ?? null),
    );
  }

  async maybeSendSignupCode(
    emailNormalized: string,
    userExists: boolean,
    requestIpOrContext: string | null | AuthRequestContext,
  ): Promise<GenericSuccessResult> {
    return this.maybeSendCode('SIGNUP', emailNormalized, userExists, requestIpOrContext);
  }

  async maybeSendResetCode(
    emailNormalized: string,
    userExists: boolean,
    requestIpOrContext: string | null | AuthRequestContext,
  ): Promise<GenericSuccessResult> {
    return this.maybeSendCode('RESET_PASSWORD', emailNormalized, userExists, requestIpOrContext);
  }

  private async maybeSendCode(
    purpose: VerificationCodePurpose,
    emailNormalized: string,
    userExists: boolean,
    requestIpOrContext: string | null | AuthRequestContext,
  ): Promise<GenericSuccessResult> {
    const startedAt = Date.now();
    const requestContext = this.normalizeRequestContext(requestIpOrContext);
    await this.assertCodeRequestAllowed(emailNormalized, purpose, requestContext);

    if (this.shouldIssueVerificationCode(purpose, userExists)) {
      await this.issueVerificationCode(emailNormalized, purpose, requestContext);
    }

    await this.recordCodeRequest(emailNormalized, purpose, requestContext);
    await recordAuthSecurityEventSafely(this.securityEvents, {
      type: 'VERIFICATION_CODE_REQUESTED',
      severity: 'INFO',
      emailNormalized,
      requestIp: requestContext.requestIp,
      userAgent: requestContext.userAgent,
      metadata: {
        purpose,
        metricName:
          purpose === 'RESET_PASSWORD'
            ? AUTH_SECURITY_EVENT_METRICS.resetRequest
            : 'auth.signup.code.request',
      },
    });
    await ensureMinDuration(startedAt, CODE_REQUEST_MIN_RESPONSE_MS);
    return { success: true };
  }

  async verifyEmailCode(
    email: string,
    code: string,
    requestContext: AuthRequestContext = {},
  ): Promise<VerificationGrantIssueResult> {
    return this.verifyCode(email, 'SIGNUP', code, requestContext, null);
  }

  async verifyResetCode(
    email: string,
    code: string,
    eligibleUserId: string,
    requestContext: AuthRequestContext = {},
  ): Promise<VerificationGrantIssueResult> {
    return this.verifyCode(email, 'RESET_PASSWORD', code, requestContext, eligibleUserId);
  }

  resolveVerificationGrant(
    rawGrant: string | null,
    purpose: VerificationCodePurpose,
  ): Promise<ResolvedVerificationGrant | null> {
    return this.verificationStore.resolveVerificationGrant(rawGrant, purpose);
  }

  private async issueVerificationCode(
    emailNormalized: string,
    purpose: VerificationCodePurpose,
    requestContext: AuthRequestContext,
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
      requestIp: requestContext.requestIp ?? null,
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

  private normalizeRequestContext(
    requestIpOrContext: string | null | AuthRequestContext,
  ): AuthRequestContext {
    if (
      typeof requestIpOrContext === 'object' &&
      requestIpOrContext !== null &&
      ('requestIp' in requestIpOrContext || 'userAgent' in requestIpOrContext)
    ) {
      return {
        requestIp: requestIpOrContext.requestIp ?? null,
        userAgent: requestIpOrContext.userAgent ?? null,
      };
    }

    return {
      requestIp: typeof requestIpOrContext === 'string' ? requestIpOrContext : null,
      userAgent: null,
    };
  }

  private async verifyCode(
    email: string,
    purpose: VerificationCodePurpose,
    code: string,
    requestContext: AuthRequestContext = {},
    eligibleUserId: string | null,
  ): Promise<VerificationGrantIssueResult> {
    const emailNormalized = normalizeEmail(email);
    const record = await this.verificationStore.findActiveVerificationRecord(
      emailNormalized,
      purpose,
      VERIFICATION_CODE_MAX_ATTEMPTS,
    );

    if (!record) {
      await this.recordVerificationCodeResult(emailNormalized, purpose, false, requestContext, {
        reason: 'missing_or_consumed',
      });
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
      await this.recordVerificationCodeResult(emailNormalized, purpose, false, requestContext, {
        reason: 'invalid_code',
      });
      return authFailures.verificationCodeInvalid();
    }

    const rawGrant = createVerificationGrant(record.id);
    const verified = await this.verificationStore.markVerifiedAndIssueGrant({
      id: record.id,
      emailNormalized,
      purpose,
      maxAttempts: VERIFICATION_CODE_MAX_ATTEMPTS,
      grantTokenHash: hashVerificationGrant(rawGrant),
      grantTtlSeconds: AUTH_VERIFICATION_GRANT_TTL_SECONDS,
      eligibleUserId,
    });
    if (!verified) {
      await this.recordVerificationCodeResult(emailNormalized, purpose, false, requestContext, {
        reason: 'stale_or_expired',
      });
      return authFailures.verificationCodeInvalid();
    }

    await this.recordVerificationCodeResult(emailNormalized, purpose, true, requestContext);
    return purpose === 'SIGNUP'
      ? {
          success: true,
          signupGrant: rawGrant,
          grantExpiresInSeconds: AUTH_VERIFICATION_GRANT_TTL_SECONDS,
        }
      : {
          success: true,
          resetGrant: rawGrant,
          grantExpiresInSeconds: AUTH_VERIFICATION_GRANT_TTL_SECONDS,
        };
  }

  private async recordVerificationCodeResult(
    emailNormalized: string,
    purpose: VerificationCodePurpose,
    success: boolean,
    requestContext: AuthRequestContext,
    metadata: Record<string, string> = {},
  ) {
    await recordAuthSecurityEventSafely(this.securityEvents, {
      type: success ? 'VERIFICATION_CODE_VERIFY_SUCCESS' : 'VERIFICATION_CODE_VERIFY_FAILURE',
      severity: success ? 'INFO' : 'WARNING',
      emailNormalized,
      requestIp: requestContext.requestIp,
      userAgent: requestContext.userAgent,
      metadata: {
        purpose,
        ...metadata,
      },
    });
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

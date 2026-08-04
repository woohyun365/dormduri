import { Inject, Injectable, Optional } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { VerificationCodePurpose } from '../../generated/prisma/enums.js';
import {
  AUTH_VERIFICATION_CODE_MAX_ATTEMPTS,
  AUTH_VERIFICATION_GRANT_TTL_SECONDS,
  RESET_PASSWORD_VERIFICATION_CODE_TTL_SECONDS,
  SIGNUP_VERIFICATION_CODE_TTL_SECONDS,
} from '@repo/shared/auth/policy';
import {
  AUTH_CODE_REQUEST_MIN_RESPONSE_MILLISECONDS,
  ensureMinVerificationResponseDuration,
} from './request/auth-verification-timing.policy.js';
import type {
  GenericErrorResponse,
  VerifyResetCodeTransportResponse,
  VerifySignupCodeTransportResponse,
} from '@repo/shared/auth/response';
import { normalizeAuthEmail } from '../domain/auth-email-identity.policy.js';
import {
  generateVerificationCode,
  hashVerificationCode,
  safeTimeEquals,
} from './challenge/verification-code.crypto.js';
import authConfig from '../../config/auth.config.js';
import { authErrors } from '../errors/auth.errors.js';
import { authFailures } from '../errors/auth-failures.js';
import type { AuthRequestContext } from '../domain/auth-request-context.js';
import {
  AuthSecurityEventService,
  recordAuthSecurityEventSafely,
} from '../security-events/auth-security-event.service.js';
import { AUTH_SECURITY_EVENT_METRICS } from '../security-events/auth-security-event.types.js';
import { createVerificationGrant, hashVerificationGrant } from './grant/auth-verification-grant.js';
import { AuthVerificationChallengeRepository } from './challenge/auth-verification-challenge.repository.js';
import {
  AuthVerificationGrantRepository,
  type ResolvedVerificationGrant,
} from './grant/auth-verification-grant.repository.js';
import { hashAuthPersistenceDimension } from '../persistence/auth-persistence-dimension.js';
import { AuthMailEnvelopeWriter } from '../mail/auth-mail-envelope-writer.service.js';
import {
  AuthVerificationRequestRepository,
  VerificationRequestThrottledError,
} from './request/auth-verification-request.repository.js';
import { AuthVerificationMetricsService } from './auth-verification-metrics.service.js';

const VERIFICATION_CODE_TTL_BY_PURPOSE = {
  SIGNUP: SIGNUP_VERIFICATION_CODE_TTL_SECONDS,
  RESET_PASSWORD: RESET_PASSWORD_VERIFICATION_CODE_TTL_SECONDS,
} as const satisfies Record<VerificationCodePurpose, number>;

type VerificationTransportResponse =
  | VerifySignupCodeTransportResponse
  | VerifyResetCodeTransportResponse;

@Injectable()
export class AuthVerificationService {
  constructor(
    private readonly verificationRequests: AuthVerificationRequestRepository,
    private readonly verificationChallenges: AuthVerificationChallengeRepository,
    private readonly verificationGrants: AuthVerificationGrantRepository,
    private readonly mailEnvelopeWriter: AuthMailEnvelopeWriter,
    @Inject(authConfig.KEY)
    private readonly authSettings: ConfigType<typeof authConfig>,
    @Optional() private readonly securityEvents?: AuthSecurityEventService,
    @Optional() private readonly metrics?: AuthVerificationMetricsService,
  ) {}

  async assertCodeRequestAllowed(
    emailNormalized: string,
    purpose: VerificationCodePurpose,
    requestIpOrContext: string | null | AuthRequestContext,
  ): Promise<void> {
    const requestContext = this.normalizeRequestContext(requestIpOrContext);
    const normalizedIp = this.normalizeRequestIp(requestContext.requestIp ?? null);
    const subjectKey = this.toSubjectKey(emailNormalized);
    const requestIpKey = this.toRequestIpKey(normalizedIp);
    const ipRetryAfterSeconds = await this.verificationRequests.findRetryAfterSeconds(
      subjectKey,
      purpose,
      requestIpKey,
      this.authSettings.codeRequestCooldownSeconds,
    );

    const backstopRetryAfterSeconds = await this.verificationRequests.findBackstopRetryAfterSeconds(
      subjectKey,
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

  async maybeSendSignupCode(
    emailNormalized: string,
    userExists: boolean,
    requestIpOrContext: string | null | AuthRequestContext,
  ): Promise<GenericErrorResponse> {
    return this.maybeSendCode('SIGNUP', emailNormalized, userExists, requestIpOrContext);
  }

  async maybeSendResetCode(
    emailNormalized: string,
    userExists: boolean,
    requestIpOrContext: string | null | AuthRequestContext,
  ): Promise<GenericErrorResponse> {
    return this.maybeSendCode('RESET_PASSWORD', emailNormalized, userExists, requestIpOrContext);
  }

  private async maybeSendCode(
    purpose: VerificationCodePurpose,
    emailNormalized: string,
    userExists: boolean,
    requestIpOrContext: string | null | AuthRequestContext,
  ): Promise<GenericErrorResponse> {
    const startedAt = Date.now();
    const requestContext = this.normalizeRequestContext(requestIpOrContext);
    try {
      await this.assertCodeRequestAllowed(emailNormalized, purpose, requestContext);
    } catch (error) {
      this.metrics?.record(purpose, 'request', 'throttled');
      throw error;
    }

    const securityEventInput = {
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
    } as const;
    const candidate = this.shouldIssueVerificationCode(purpose, userExists)
      ? this.createPendingVerificationCandidate(emailNormalized, purpose, requestContext)
      : null;

    try {
      await this.verificationRequests.append({
        subjectKey: this.toSubjectKey(emailNormalized),
        purpose,
        requestIpKey: this.toRequestIpKey(
          this.normalizeRequestIp(requestContext.requestIp ?? null),
        ),
        cooldownSeconds: this.authSettings.codeRequestCooldownSeconds,
        backstopWindowSeconds: this.authSettings.codeRequestBackstopWindowSeconds,
        backstopLimit: this.authSettings.codeRequestBackstopLimit,
        candidate,
        securityEvent:
          this.securityEvents && typeof this.securityEvents.toPersistenceData === 'function'
            ? this.securityEvents.toPersistenceData(securityEventInput)
            : null,
      });
    } catch (error) {
      if (error instanceof VerificationRequestThrottledError) {
        this.metrics?.record(purpose, 'request', 'throttled');
        throw authErrors.codeRequestThrottled(error.retryAfterSeconds);
      }
      this.metrics?.record(purpose, 'request', 'failed');
      throw error;
    }
    this.metrics?.record(purpose, 'request', 'accepted');
    await ensureMinVerificationResponseDuration(
      startedAt,
      AUTH_CODE_REQUEST_MIN_RESPONSE_MILLISECONDS,
    );
    return { success: true };
  }

  async verifyEmailCode(
    email: string,
    code: string,
    requestContext: AuthRequestContext = {},
  ): Promise<VerifySignupCodeTransportResponse> {
    return this.verifyCode(email, 'SIGNUP', code, requestContext, null);
  }

  async verifyResetCode(
    email: string,
    code: string,
    eligibleUserId: string,
    requestContext: AuthRequestContext = {},
  ): Promise<VerifyResetCodeTransportResponse> {
    return this.verifyCode(email, 'RESET_PASSWORD', code, requestContext, eligibleUserId);
  }

  resolveVerificationGrant(
    rawGrant: string | null,
    purpose: VerificationCodePurpose,
  ): Promise<ResolvedVerificationGrant | null> {
    return this.verificationGrants.resolve(rawGrant, purpose);
  }

  matchesVerificationGrantSubject(
    grant: Pick<ResolvedVerificationGrant, 'subjectKey'>,
    emailNormalized: string,
  ): boolean {
    return grant.subjectKey === this.toSubjectKey(emailNormalized);
  }

  private createPendingVerificationCandidate(
    emailNormalized: string,
    purpose: VerificationCodePurpose,
    requestContext: AuthRequestContext,
  ) {
    const ttlSeconds = VERIFICATION_CODE_TTL_BY_PURPOSE[purpose];
    const code = generateVerificationCode();
    const codeHash = hashVerificationCode(
      emailNormalized,
      purpose,
      code,
      this.authSettings.verificationCodeHmacSecret,
    );

    const emailEnvelope = this.mailEnvelopeWriter.encrypt({
      schemaVersion: 1,
      mailKind: purpose === 'SIGNUP' ? 'SIGNUP_VERIFICATION' : 'PASSWORD_RESET_VERIFICATION',
      email: emailNormalized,
      code,
      expiresInSeconds: ttlSeconds,
    });

    return {
      id: randomUUID(),
      subjectKey: this.toSubjectKey(emailNormalized),
      codeHash,
      ttlSeconds,
      requestIpKey: this.toRequestIpKey(this.normalizeRequestIp(requestContext.requestIp ?? null)),
      emailEnvelope,
    };
  }

  private shouldIssueVerificationCode(
    purpose: VerificationCodePurpose,
    userExists: boolean,
  ): boolean {
    return purpose === 'SIGNUP' ? !userExists : userExists;
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

  private verifyCode(
    email: string,
    purpose: 'SIGNUP',
    code: string,
    requestContext: AuthRequestContext,
    eligibleUserId: null,
  ): Promise<VerifySignupCodeTransportResponse>;
  private verifyCode(
    email: string,
    purpose: 'RESET_PASSWORD',
    code: string,
    requestContext: AuthRequestContext,
    eligibleUserId: string,
  ): Promise<VerifyResetCodeTransportResponse>;
  private async verifyCode(
    email: string,
    purpose: VerificationCodePurpose,
    code: string,
    requestContext: AuthRequestContext = {},
    eligibleUserId: string | null,
  ): Promise<VerificationTransportResponse> {
    const emailNormalized = normalizeAuthEmail(email);
    const subjectKey = this.toSubjectKey(emailNormalized);
    const record = await this.verificationChallenges.findActive(
      subjectKey,
      purpose,
      AUTH_VERIFICATION_CODE_MAX_ATTEMPTS,
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
      await this.handleFailedVerification(record.id, subjectKey, purpose);
      await this.recordVerificationCodeResult(emailNormalized, purpose, false, requestContext, {
        reason: 'invalid_code',
      });
      return authFailures.verificationCodeInvalid();
    }

    const rawGrant = createVerificationGrant(record.id);
    const verified = await this.verificationChallenges.markVerifiedAndIssueGrant({
      id: record.id,
      subjectKey,
      purpose,
      maxAttempts: AUTH_VERIFICATION_CODE_MAX_ATTEMPTS,
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
    this.metrics?.record(purpose, 'verify', success ? 'accepted' : 'rejected');
    if (success) {
      this.metrics?.record(purpose, 'grant', 'issued');
    }
  }

  private async handleFailedVerification(
    id: string,
    subjectKey: string,
    purpose: VerificationCodePurpose,
  ): Promise<void> {
    await this.verificationChallenges.recordFailure({
      id,
      subjectKey,
      purpose,
      maxAttempts: AUTH_VERIFICATION_CODE_MAX_ATTEMPTS,
    });
  }

  private toSubjectKey(emailNormalized: string): string {
    return hashAuthPersistenceDimension(
      'subject',
      emailNormalized,
      this.authSettings.persistenceHmacSecret,
      this.authSettings.persistenceHmacKeyVersion,
    );
  }

  private toRequestIpKey(requestIp: string): string {
    return hashAuthPersistenceDimension(
      'request-ip',
      requestIp,
      this.authSettings.persistenceHmacSecret,
      this.authSettings.persistenceHmacKeyVersion,
    );
  }
}

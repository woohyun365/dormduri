import { Injectable } from '@nestjs/common';
import type { GenericSuccessResult, VerificationGrantIssueResult } from '../domain/auth.types.js';
import { authFailures } from '../errors/auth-failures.js';
import { isKnuEmail, normalizeEmail } from '../domain/auth.utils.js';
import { hasAuthRequestContext, type AuthRequestContext } from '../domain/auth-request-context.js';
import { AuthVerificationEligibilityQuery } from './auth-verification-eligibility.query.js';
import { AuthVerificationService } from './auth-verification.service.js';

@Injectable()
export class AuthVerificationUseCases {
  constructor(
    private readonly verificationService: AuthVerificationService,
    private readonly verificationEligibilityQuery: AuthVerificationEligibilityQuery,
  ) {}

  async sendSignupCode(
    email: string,
    requestIpOrContext: string | null | AuthRequestContext,
  ): Promise<GenericSuccessResult> {
    const emailNormalized = normalizeEmail(email);
    if (!isKnuEmail(emailNormalized)) {
      return authFailures.invalidKnuEmail();
    }

    const userExists = await this.verificationEligibilityQuery.signupUserExists(emailNormalized);

    return this.verificationService.maybeSendSignupCode(
      emailNormalized,
      userExists,
      requestIpOrContext,
    );
  }

  async sendResetCode(
    email: string,
    requestIpOrContext: string | null | AuthRequestContext,
  ): Promise<GenericSuccessResult> {
    const emailNormalized = normalizeEmail(email);
    const resetEligible =
      await this.verificationEligibilityQuery.passwordResetEligible(emailNormalized);

    return this.verificationService.maybeSendResetCode(
      emailNormalized,
      resetEligible,
      requestIpOrContext,
    );
  }

  async verifyEmailCode(
    email: string,
    code: string,
    requestContext: AuthRequestContext = {},
  ): Promise<VerificationGrantIssueResult> {
    if (!hasAuthRequestContext(requestContext)) {
      return this.verificationService.verifyEmailCode(email, code);
    }
    return this.verificationService.verifyEmailCode(email, code, requestContext);
  }

  async verifyResetCode(
    email: string,
    code: string,
    requestContext: AuthRequestContext = {},
  ): Promise<VerificationGrantIssueResult> {
    const emailNormalized = normalizeEmail(email);
    const eligibleUserId =
      await this.verificationEligibilityQuery.findPasswordResetEligibleUserId(emailNormalized);

    if (!eligibleUserId) {
      return authFailures.verificationCodeInvalid();
    }

    if (!hasAuthRequestContext(requestContext)) {
      return this.verificationService.verifyResetCode(email, code, eligibleUserId);
    }
    return this.verificationService.verifyResetCode(email, code, eligibleUserId, requestContext);
  }
}

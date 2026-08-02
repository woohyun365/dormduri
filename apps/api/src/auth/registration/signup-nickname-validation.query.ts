import { Injectable } from '@nestjs/common';
import type { SignupNicknameValidationResponse } from '@repo/shared/auth/response';
import {
  DisplayIdentityNicknamePolicyError,
  DisplayIdentityNicknamePolicyService,
} from '../../users/identity/display/display-identity-nickname-policy.service.js';
import { authFailures } from '../errors/auth-failures.js';
import { AuthFlowMetricsService } from '../operations/auth-flow-metrics.service.js';
import { AuthVerificationService } from '../verification/auth-verification.service.js';
import { SignupNicknameValidationAdmissionService } from './signup-nickname-validation-admission.service.js';

@Injectable()
export class SignupNicknameValidationQuery {
  constructor(
    private readonly verificationService: AuthVerificationService,
    private readonly nicknamePolicy: DisplayIdentityNicknamePolicyService,
    private readonly admission: SignupNicknameValidationAdmissionService,
    private readonly flowMetrics: AuthFlowMetricsService,
  ) {}

  async execute(
    nickname: string,
    verificationGrant: string | null,
  ): Promise<SignupNicknameValidationResponse> {
    const grant = await this.verificationService.resolveVerificationGrant(
      verificationGrant,
      'SIGNUP',
    );
    if (!grant) {
      this.flowMetrics.recordSignupNicknameValidation('verification_required');
      return authFailures.signupVerificationRequired();
    }

    const retryAfterSeconds = await this.admission.consume(grant.tokenHash);
    if (retryAfterSeconds) {
      this.flowMetrics.recordSignupNicknameValidation('throttled');
      return authFailures.signupNicknameValidationThrottled(retryAfterSeconds);
    }

    try {
      const parsed = await this.nicknamePolicy.validate(nickname);
      this.flowMetrics.recordSignupNicknameValidation('available');
      return { success: true, nickname: parsed.value };
    } catch (error) {
      if (!(error instanceof DisplayIdentityNicknamePolicyError)) {
        this.flowMetrics.recordSignupNicknameValidation('failed');
        throw error;
      }

      switch (error.reason) {
        case 'INVALID_FORMAT':
          this.flowMetrics.recordSignupNicknameValidation('invalid');
          return authFailures.signupNicknameInvalid(error.message);
        case 'MODERATION_REJECTED':
          this.flowMetrics.recordSignupNicknameValidation('moderation_rejected');
          return authFailures.signupNicknameNotAllowed(error.message);
        case 'ALREADY_TAKEN':
          this.flowMetrics.recordSignupNicknameValidation('taken');
          return authFailures.nicknameAlreadyTaken();
      }
    }
  }
}

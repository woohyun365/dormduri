import { Injectable } from '@nestjs/common';
import type { SignupNicknameValidationResponse } from '@repo/shared/auth/response';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { DisplayIdentityNicknamePolicyService } from '../../users/identity/display/display-identity-nickname-policy.service.js';
import type { LoginResult, SignupInput } from '../domain/auth.types.js';
import { AuthSessionService } from '../sessions/auth-session.service.js';
import { AuthVerificationService } from '../verification/auth-verification.service.js';
import { signup } from './signup.command.js';
import { AuthFlowMetricsService } from '../operations/auth-flow-metrics.service.js';
import { SignupNicknameValidationQuery } from './signup-nickname-validation.query.js';
import type { AuthRequestContext } from '../domain/auth-request-context.js';
import { SignupSubmissionAdmissionService } from './signup-submission-admission.service.js';
import { AuthSecurityEventService } from '../security-events/auth-security-event.service.js';
import { AuthPasswordPolicyService } from '../credentials/password-policy.service.js';

@Injectable()
export class AuthRegistrationUseCases {
  constructor(
    private readonly prisma: PrismaService,
    private readonly verificationService: AuthVerificationService,
    private readonly sessionService: AuthSessionService,
    private readonly passwordPolicy: AuthPasswordPolicyService,
    private readonly nicknamePolicy: DisplayIdentityNicknamePolicyService,
    private readonly signupNicknameValidationQuery: SignupNicknameValidationQuery,
    private readonly signupSubmissionAdmission: SignupSubmissionAdmissionService,
    private readonly securityEvents: AuthSecurityEventService,
    private readonly flowMetrics?: AuthFlowMetricsService,
  ) {}

  validateSignupNickname(
    nickname: string,
    verificationGrant: string | null,
  ): Promise<SignupNicknameValidationResponse> {
    return this.signupNicknameValidationQuery.execute(nickname, verificationGrant);
  }

  async signup(
    input: SignupInput,
    verificationGrant: string | null = null,
    requestContext: AuthRequestContext = {},
  ): Promise<LoginResult> {
    try {
      const result = await signup(
        {
          prisma: this.prisma,
          verificationService: this.verificationService,
          sessionService: this.sessionService,
          passwordPolicy: this.passwordPolicy,
          nicknamePolicy: this.nicknamePolicy,
          submissionAdmission: this.signupSubmissionAdmission,
          securityEvents: this.securityEvents,
          flowMetrics: this.flowMetrics,
        },
        input,
        verificationGrant,
        requestContext,
      );
      this.flowMetrics?.recordCredentialTransition(
        'signup',
        result.success ? 'committed' : 'rejected',
      );
      return result;
    } catch (error) {
      this.flowMetrics?.recordCredentialTransition('signup', 'failed');
      throw error;
    }
  }
}

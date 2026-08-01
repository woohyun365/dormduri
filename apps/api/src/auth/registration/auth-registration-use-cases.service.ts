import { Injectable } from '@nestjs/common';
import type { SignupDraftValidationResponse } from '@repo/shared/auth/response';
import { PrismaService } from '../../platform/database/prisma.service.js';
import type { LoginResult, SignupInput } from '../domain/auth.types.js';
import { AuthSessionService } from '../sessions/auth-session.service.js';
import { AuthVerificationService } from '../verification/auth-verification.service.js';
import { AuthSignupValidationService } from './auth-signup-validation.service.js';
import { signup } from './signup.command.js';
import { AuthFlowMetricsService } from '../operations/auth-flow-metrics.service.js';

@Injectable()
export class AuthRegistrationUseCases {
  constructor(
    private readonly prisma: PrismaService,
    private readonly verificationService: AuthVerificationService,
    private readonly sessionService: AuthSessionService,
    private readonly signupValidationService: AuthSignupValidationService,
    private readonly flowMetrics?: AuthFlowMetricsService,
  ) {}

  validateSignupDraft(input: {
    email: string;
    password: string;
    nickname: string;
  }): Promise<SignupDraftValidationResponse> {
    return this.signupValidationService.validateDraft(input);
  }

  async signup(input: SignupInput, verificationGrant: string | null = null): Promise<LoginResult> {
    try {
      const result = await signup(
        {
          prisma: this.prisma,
          verificationService: this.verificationService,
          sessionService: this.sessionService,
          signupValidationService: this.signupValidationService,
        },
        input,
        verificationGrant,
      );
      this.flowMetrics?.recordCredentialTransition(
        'signup',
        result.success
          ? 'committed'
          : result.code === 'AUTH_ACCOUNT_CREATED_LOGIN_REQUIRED'
            ? 'committed_login_required'
            : 'rejected',
      );
      return result;
    } catch (error) {
      this.flowMetrics?.recordCredentialTransition('signup', 'failed');
      throw error;
    }
  }
}

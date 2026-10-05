import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './application/auth.service.js';
import {
  changePasswordRequestSchema,
  emailRequestSchema,
  loginRequestSchema,
  logoutRequestSchema,
  renewSessionRequestSchema,
  resetPasswordRequestSchema,
  signupNicknameValidationRequestSchema,
  signupRequestSchema,
  verificationCodeRequestSchema,
  AUTH_VERIFICATION_GRANT_HEADER,
  type EmailRequest,
  type VerificationCodeRequest,
  type SignupNicknameValidationRequest,
  type SignupRequest,
  type LoginRequest,
  type ResetPasswordRequest,
  type ChangePasswordRequest,
  type RenewSessionRequest,
  type LogoutRequest,
} from '@repo/shared/auth/contract';
import { parseRequestBody } from '../platform/http/zod-request.js';
import { ZodRequestPipe } from '../platform/http/zod-request.pipe.js';
import { OptionalAuth, Public, RequireCapability } from './access/auth-access.decorator.js';
import { AUTH_CAPABILITIES } from './access/auth-capability.js';
import { CurrentAuthToken, CurrentUser } from './access/authenticated-user.decorator.js';
import type { AuthenticatedUserContext } from './application/auth-actor-context.types.js';
import type { AuthRequestContext } from './domain/auth-request-context.js';
import { AuthRequestMetadata } from './access/auth-request-context.decorator.js';
import { EnableAuthLoginThrottle } from './login-attempts/network-throttle/auth-login-throttle.decorator.js';
import { authErrors } from './errors/auth.errors.js';
import { AUTH_PASSWORD_HASH_CAPACITY_UNAVAILABLE_CODE } from '@repo/shared/auth/response';

function throwIfPasswordHashCapacityUnavailable(result: {
  success: boolean;
  code?: string;
  retryAfterSeconds?: number;
}): void {
  if (!result.success && result.code === AUTH_PASSWORD_HASH_CAPACITY_UNAVAILABLE_CODE) {
    throw authErrors.passwordHashCapacityUnavailable(result.retryAfterSeconds ?? 1);
  }
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-signup-code')
  @Public()
  async sendSignupCode(
    @Body(new ZodRequestPipe((body: unknown) => parseRequestBody(emailRequestSchema, body)))
    parsed: EmailRequest,
    @AuthRequestMetadata() requestContext: AuthRequestContext,
  ) {
    return this.authService.sendSignupCode(parsed.email, requestContext);
  }

  @Post('send-reset-code')
  @Public()
  async sendResetCode(
    @Body(new ZodRequestPipe((body: unknown) => parseRequestBody(emailRequestSchema, body)))
    parsed: EmailRequest,
    @AuthRequestMetadata() requestContext: AuthRequestContext,
  ) {
    return this.authService.sendResetCode(parsed.email, requestContext);
  }

  @Post('verify-email-code')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async verifyEmailCode(
    @Body(
      new ZodRequestPipe((body: unknown) => parseRequestBody(verificationCodeRequestSchema, body)),
    )
    parsed: VerificationCodeRequest,
    @AuthRequestMetadata() requestContext: AuthRequestContext,
  ) {
    return this.authService.verifyEmailCode(parsed.email, parsed.code, requestContext);
  }

  @Post('verify-reset-code')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async verifyResetCode(
    @Body(
      new ZodRequestPipe((body: unknown) => parseRequestBody(verificationCodeRequestSchema, body)),
    )
    parsed: VerificationCodeRequest,
    @AuthRequestMetadata() requestContext: AuthRequestContext,
  ) {
    return this.authService.verifyResetCode(parsed.email, parsed.code, requestContext);
  }

  @Get('session')
  @OptionalAuth()
  @HttpCode(200)
  async session(
    @CurrentAuthToken({ optional: true }) token: string | null,
    @AuthRequestMetadata() requestContext: AuthRequestContext,
  ) {
    return this.authService.getSession(token, requestContext);
  }

  @Post('signup/validate-nickname')
  @Public()
  @HttpCode(200)
  async validateSignupNickname(
    @Body(
      new ZodRequestPipe((body: unknown) =>
        parseRequestBody(signupNicknameValidationRequestSchema, body),
      ),
    )
    parsed: SignupNicknameValidationRequest,
    @Headers(AUTH_VERIFICATION_GRANT_HEADER) verificationGrant?: string,
  ) {
    return this.authService.validateSignupNickname(parsed.nickname, verificationGrant ?? null);
  }

  @Post('signup')
  @Public()
  async signup(
    @Body(new ZodRequestPipe((body: unknown) => parseRequestBody(signupRequestSchema, body)))
    parsed: SignupRequest,
    @Headers(AUTH_VERIFICATION_GRANT_HEADER) verificationGrant: string | undefined,
    @AuthRequestMetadata() requestContext: AuthRequestContext,
  ) {
    const result = await this.authService.signup(parsed, verificationGrant ?? null, requestContext);
    if (!result.success && result.code === 'AUTH_SIGNUP_SUBMISSION_THROTTLED') {
      throw authErrors.signupSubmissionThrottled(result.retryAfterSeconds ?? 1);
    }
    throwIfPasswordHashCapacityUnavailable(result);
    return result;
  }

  @Post('login')
  @Public()
  @EnableAuthLoginThrottle()
  @HttpCode(200)
  async login(
    @Body(new ZodRequestPipe((body: unknown) => parseRequestBody(loginRequestSchema, body)))
    parsed: LoginRequest,
    @AuthRequestMetadata() requestContext: AuthRequestContext,
  ) {
    const result = await this.authService.login(
      parsed.email,
      parsed.password,
      parsed.rememberMe ?? false,
      requestContext,
    );
    throwIfPasswordHashCapacityUnavailable(result);
    return result;
  }

  @Post('reset-password')
  @Public()
  async resetPassword(
    @Body(new ZodRequestPipe((body: unknown) => parseRequestBody(resetPasswordRequestSchema, body)))
    parsed: ResetPasswordRequest,
    @Headers(AUTH_VERIFICATION_GRANT_HEADER) verificationGrant: string | undefined,
    @AuthRequestMetadata() requestContext: AuthRequestContext,
  ) {
    const result = await this.authService.resetPassword(
      verificationGrant ?? null,
      parsed.newPassword,
      requestContext,
    );
    throwIfPasswordHashCapacityUnavailable(result);
    return result;
  }

  @Post('change-password')
  @RequireCapability(AUTH_CAPABILITIES.AUTH_PASSWORD_CHANGE_SELF)
  @HttpCode(200)
  async changePassword(
    @Body(
      new ZodRequestPipe((body: unknown) => parseRequestBody(changePasswordRequestSchema, body)),
    )
    parsed: ChangePasswordRequest,
    @CurrentUser() authUser: AuthenticatedUserContext,
    @AuthRequestMetadata() requestContext: AuthRequestContext,
  ) {
    const result = await this.authService.changePassword(
      authUser,
      parsed.currentPassword,
      parsed.newPassword,
      requestContext,
    );
    if (!result.success && result.code === 'AUTH_CHANGE_PASSWORD_THROTTLED') {
      throw authErrors.changePasswordThrottled(result.retryAfterSeconds ?? 1);
    }
    throwIfPasswordHashCapacityUnavailable(result);
    return result;
  }

  @Post('renew-session')
  @Public()
  @HttpCode(200)
  async renewSession(
    @Body(new ZodRequestPipe((body: unknown) => parseRequestBody(renewSessionRequestSchema, body)))
    parsed: RenewSessionRequest,
    @AuthRequestMetadata() requestContext: AuthRequestContext,
  ) {
    return this.authService.renewSession(parsed.renewalToken, requestContext);
  }

  @Post('logout')
  @OptionalAuth()
  @HttpCode(200)
  async logout(
    @CurrentAuthToken({ optional: true }) token: string | null,
    @Body(new ZodRequestPipe((body: unknown) => parseRequestBody(logoutRequestSchema, body ?? {})))
    parsed: LogoutRequest,
    @AuthRequestMetadata() requestContext: AuthRequestContext,
  ) {
    return this.authService.logout(token, parsed.renewalToken ?? null, requestContext);
  }
}

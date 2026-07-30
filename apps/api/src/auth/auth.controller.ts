import { Body, Controller, Get, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './application/auth.service.js';
import {
  changePasswordRequestSchema,
  emailRequestSchema,
  loginRequestSchema,
  renewSessionRequestSchema,
  resetPasswordRequestSchema,
  signupDraftValidationRequestSchema,
  signupRequestSchema,
  verificationCodeRequestSchema,
  AUTH_VERIFICATION_GRANT_HEADER,
} from '@repo/shared/auth/contract';
import { parseRequestBody } from '../platform/http/zod-request.js';
import { OptionalAuth, Public, RequireCapability } from './access/auth-access.decorator.js';
import { AUTH_CAPABILITIES } from './access/auth-capability.js';
import { CurrentAuthToken, CurrentUser } from './access/authenticated-user.decorator.js';
import type { AuthenticatedUserContext } from './application/auth-actor-context.types.js';
import { resolveAuthRequestContext } from './domain/auth-request-context.js';
import { EnableAuthLoginThrottle } from './login-attempts/auth-login-throttle.decorator.js';

@Controller('auth')
@Public()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-signup-code')
  async sendSignupCode(@Body() body: unknown, @Req() req: Request) {
    const parsed = parseRequestBody(emailRequestSchema, body);
    return this.authService.sendSignupCode(parsed.email, resolveAuthRequestContext(req));
  }

  @Post('send-reset-code')
  async sendResetCode(@Body() body: unknown, @Req() req: Request) {
    const parsed = parseRequestBody(emailRequestSchema, body);
    return this.authService.sendResetCode(parsed.email, resolveAuthRequestContext(req));
  }

  @Post('verify-email-code')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async verifyEmailCode(@Body() body: unknown, @Req() req: Request) {
    const parsed = parseRequestBody(verificationCodeRequestSchema, body);
    return this.authService.verifyEmailCode(
      parsed.email,
      parsed.code,
      resolveAuthRequestContext(req),
    );
  }

  @Post('verify-reset-code')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async verifyResetCode(@Body() body: unknown, @Req() req: Request) {
    const parsed = parseRequestBody(verificationCodeRequestSchema, body);
    return this.authService.verifyResetCode(
      parsed.email,
      parsed.code,
      resolveAuthRequestContext(req),
    );
  }

  @Get('session')
  @OptionalAuth()
  @HttpCode(200)
  async session(@CurrentAuthToken({ optional: true }) token: string | null, @Req() req: Request) {
    return this.authService.getSession(token, resolveAuthRequestContext(req));
  }

  @Post('validate-signup-draft')
  async validateSignupDraft(@Body() body: unknown) {
    const parsed = parseRequestBody(signupDraftValidationRequestSchema, body);
    return this.authService.validateSignupDraft(parsed);
  }

  @Post('signup')
  async signup(
    @Body() body: unknown,
    @Headers(AUTH_VERIFICATION_GRANT_HEADER) verificationGrant?: string,
  ) {
    const parsed = parseRequestBody(signupRequestSchema, body);
    return this.authService.signup(parsed, verificationGrant ?? null);
  }

  @Post('login')
  @EnableAuthLoginThrottle()
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() req: Request) {
    const parsed = parseRequestBody(loginRequestSchema, body);
    return this.authService.login(
      parsed.email,
      parsed.password,
      parsed.rememberMe ?? false,
      resolveAuthRequestContext(req),
    );
  }

  @Post('reset-password')
  async resetPassword(
    @Body() body: unknown,
    @Headers(AUTH_VERIFICATION_GRANT_HEADER) verificationGrant: string | undefined,
    @Req() req: Request,
  ) {
    const parsed = parseRequestBody(resetPasswordRequestSchema, body);
    return this.authService.resetPassword(
      verificationGrant ?? null,
      parsed.newPassword,
      resolveAuthRequestContext(req),
    );
  }

  @Post('change-password')
  @RequireCapability(AUTH_CAPABILITIES.AUTH_PASSWORD_CHANGE_SELF)
  @HttpCode(200)
  async changePassword(
    @Body() body: unknown,
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    const parsed = parseRequestBody(changePasswordRequestSchema, body);
    return this.authService.changePassword(
      authUser,
      parsed.currentPassword,
      parsed.newPassword,
      resolveAuthRequestContext(req),
    );
  }

  @Post('renew-session')
  @HttpCode(200)
  async renewSession(@Body() body: unknown, @Req() req: Request) {
    const parsed = parseRequestBody(renewSessionRequestSchema, body);
    return this.authService.renewSession(parsed.renewalToken, resolveAuthRequestContext(req));
  }

  @Post('logout')
  @OptionalAuth()
  @HttpCode(200)
  async logout(
    @CurrentAuthToken({ optional: true }) token: string | null,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const renewalToken =
      typeof body === 'object' &&
      body !== null &&
      'renewalToken' in body &&
      typeof body.renewalToken === 'string'
        ? body.renewalToken
        : null;

    return this.authService.logout(token, renewalToken, resolveAuthRequestContext(req));
  }
}

import { Body, Controller, Get, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import {
  changePasswordRequestSchema,
  emailRequestSchema,
  loginRequestSchema,
  renewSessionRequestSchema,
  resetPasswordRequestSchema,
  signupDraftValidationRequestSchema,
  signupRequestSchema,
  verificationCodeRequestSchema,
} from '@repo/shared/auth-contract';
import { parseRequestBody } from '../common/http/zod-request.js';
import { OptionalAuth, Public, RequireCapability } from './auth-access.decorator.js';
import { AUTH_CAPABILITIES } from './auth-capability.js';
import { CurrentUser } from './authenticated-user.decorator.js';
import type { AuthenticatedUserContext } from './auth-session.service.js';

@Controller('auth')
@Public()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-signup-code')
  async sendSignupCode(@Body() body: unknown, @Req() req: Request) {
    const parsed = parseRequestBody(emailRequestSchema, body);
    return this.authService.sendSignupCode(parsed.email, req.ip ?? null);
  }

  @Post('send-reset-code')
  async sendResetCode(@Body() body: unknown, @Req() req: Request) {
    const parsed = parseRequestBody(emailRequestSchema, body);
    return this.authService.sendResetCode(parsed.email, req.ip ?? null);
  }

  @Post('verify-email-code')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async verifyEmailCode(@Body() body: unknown) {
    const parsed = parseRequestBody(verificationCodeRequestSchema, body);
    return this.authService.verifyEmailCode(parsed.email, parsed.code);
  }

  @Post('verify-reset-code')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async verifyResetCode(@Body() body: unknown) {
    const parsed = parseRequestBody(verificationCodeRequestSchema, body);
    return this.authService.verifyResetCode(parsed.email, parsed.code);
  }

  @Get('session')
  @OptionalAuth()
  @HttpCode(200)
  async session(@Headers('authorization') authorization?: string) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    return this.authService.getSession(token);
  }

  @Post('validate-signup-draft')
  async validateSignupDraft(@Body() body: unknown) {
    const parsed = parseRequestBody(signupDraftValidationRequestSchema, body);
    return this.authService.validateSignupDraft(parsed);
  }

  @Post('signup')
  async signup(@Body() body: unknown) {
    const parsed = parseRequestBody(signupRequestSchema, body);
    return this.authService.signup(parsed);
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  async login(@Body() body: unknown) {
    const parsed = parseRequestBody(loginRequestSchema, body);
    return this.authService.login(parsed.email, parsed.password, parsed.rememberMe ?? false);
  }

  @Post('reset-password')
  async resetPassword(@Body() body: unknown) {
    const parsed = parseRequestBody(resetPasswordRequestSchema, body);
    return this.authService.resetPassword(parsed.email, parsed.newPassword);
  }

  @Post('change-password')
  @RequireCapability(AUTH_CAPABILITIES.AUTH_PASSWORD_CHANGE_SELF)
  @HttpCode(200)
  async changePassword(@Body() body: unknown, @CurrentUser() authUser: AuthenticatedUserContext) {
    const parsed = parseRequestBody(changePasswordRequestSchema, body);
    return this.authService.changePassword(authUser, parsed.currentPassword, parsed.newPassword);
  }

  @Post('renew-session')
  @HttpCode(200)
  async renewSession(@Body() body: unknown) {
    const parsed = parseRequestBody(renewSessionRequestSchema, body);
    return this.authService.renewSession(parsed.renewalToken);
  }

  @Post('logout')
  @OptionalAuth()
  @HttpCode(200)
  async logout(@Headers('authorization') authorization?: string, @Body() body?: unknown) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    const renewalToken =
      typeof body === 'object' &&
      body !== null &&
      'renewalToken' in body &&
      typeof body.renewalToken === 'string'
        ? body.renewalToken
        : null;

    return this.authService.logout(token, renewalToken);
  }
}

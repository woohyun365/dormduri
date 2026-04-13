import { Body, Controller, Get, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import {
  emailRequestSchema,
  loginRequestSchema,
  resetPasswordRequestSchema,
  signupProfileValidationRequestSchema,
  signupRequestSchema,
  verificationCodeRequestSchema,
} from '@repo/shared/auth-contract';
import { parseRequestBody } from '../common/http/zod-request.js';

@Controller('auth')
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
  @HttpCode(200)
  async session(@Headers('authorization') authorization?: string) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    return this.authService.getSession(token);
  }

  @Post('validate-signup-profile')
  async validateSignupProfile(@Body() body: unknown) {
    const parsed = parseRequestBody(signupProfileValidationRequestSchema, body);
    return this.authService.validateSignupProfileDraft(parsed);
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

  @Post('logout')
  @HttpCode(200)
  async logout(@Headers('authorization') authorization?: string) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    return this.authService.logout(token);
  }
}

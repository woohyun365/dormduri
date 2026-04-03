import { Body, Controller, Get, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import {
  emailRequestSchema,
  loginRequestSchema,
  resetPasswordRequestSchema,
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
    if (!parsed.ok) return parsed.error;
    return this.authService.sendSignupCode(parsed.data.email, req.ip ?? null);
  }

  @Post('send-reset-code')
  async sendResetCode(@Body() body: unknown, @Req() req: Request) {
    const parsed = parseRequestBody(emailRequestSchema, body);
    if (!parsed.ok) return parsed.error;
    return this.authService.sendResetCode(parsed.data.email, req.ip ?? null);
  }

  @Post('verify-email-code')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async verifyEmailCode(@Body() body: unknown) {
    const parsed = parseRequestBody(verificationCodeRequestSchema, body);
    if (!parsed.ok) return parsed.error;
    return this.authService.verifyEmailCode(parsed.data.email, parsed.data.code);
  }

  @Post('verify-reset-code')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async verifyResetCode(@Body() body: unknown) {
    const parsed = parseRequestBody(verificationCodeRequestSchema, body);
    if (!parsed.ok) return parsed.error;
    return this.authService.verifyResetCode(parsed.data.email, parsed.data.code);
  }

  @Get('session')
  @HttpCode(200)
  async session(@Headers('authorization') authorization?: string) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    return this.authService.getSession(token);
  }

  @Post('signup')
  async signup(@Body() body: unknown) {
    const parsed = parseRequestBody(signupRequestSchema, body);
    if (!parsed.ok) return parsed.error;
    return this.authService.signup(parsed.data);
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  async login(@Body() body: unknown) {
    const parsed = parseRequestBody(loginRequestSchema, body);
    if (!parsed.ok) return parsed.error;
    return this.authService.login(
      parsed.data.email,
      parsed.data.password,
      parsed.data.rememberMe ?? false,
    );
  }

  @Post('reset-password')
  async resetPassword(@Body() body: unknown) {
    const parsed = parseRequestBody(resetPasswordRequestSchema, body);
    if (!parsed.ok) return parsed.error;
    return this.authService.resetPassword(parsed.data.email, parsed.data.newPassword);
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Headers('authorization') authorization?: string) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    return this.authService.logout(token);
  }
}

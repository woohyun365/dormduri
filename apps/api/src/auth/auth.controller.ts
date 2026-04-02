import { Body, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import type { Campus, Gender } from '../generated/prisma/enums.js';

interface EmailBody {
  email: string;
}

interface VerifyCodeBody {
  email: string;
  code: string;
}

interface LoginBody {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface SignupBody {
  email: string;
  password: string;
  nickname: string;
  gender: Gender;
  campus: Campus;
  lifestyle: Record<string, unknown>;
  intro: string;
}

interface ResetPasswordBody {
  email: string;
  newPassword: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-signup-code')
  @Throttle({ default: { limit: 1, ttl: 60_000 } })
  async sendSignupCode(@Body() body: EmailBody, @Req() req: Request) {
    return this.authService.sendSignupCode(body.email, req.ip ?? null);
  }

  @Post('send-reset-code')
  @Throttle({ default: { limit: 1, ttl: 60_000 } })
  async sendResetCode(@Body() body: EmailBody, @Req() req: Request) {
    return this.authService.sendResetCode(body.email, req.ip ?? null);
  }

  @Post('verify-email-code')
  async verifyEmailCode(@Body() body: VerifyCodeBody) {
    return this.authService.verifyEmailCode(body.email, body.code);
  }

  @Post('verify-reset-code')
  async verifyResetCode(@Body() body: VerifyCodeBody) {
    return this.authService.verifyResetCode(body.email, body.code);
  }

  @Post('signup')
  async signup(@Body() body: SignupBody) {
    return this.authService.signup(body);
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  async login(@Body() body: LoginBody) {
    return this.authService.login(body.email, body.password, body.rememberMe ?? false);
  }

  @Post('reset-password')
  async resetPassword(@Body() body: ResetPasswordBody) {
    return this.authService.resetPassword(body.email, body.newPassword);
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Headers('authorization') authorization?: string) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    return this.authService.logout(token);
  }
}

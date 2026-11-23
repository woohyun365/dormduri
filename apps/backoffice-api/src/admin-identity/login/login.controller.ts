import { Body, Controller, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import {
  loginPasskeyRequestSchema,
  loginPasswordRequestSchema,
  loginRecoveryCodeRequestSchema,
  loginTotpRequestSchema,
  type LoginPasskeyRequest,
  type LoginPasswordRequest,
  type LoginRecoveryCodeRequest,
  type LoginTotpRequest,
} from '@repo/shared/backoffice';
import { PublicRoute } from '../../access-control/route-access.js';
import { RequestId } from '../../platform/http/request-decorators.js';
import { ZodPipe } from '../../platform/http/zod-pipe.js';
import type { IssuedSession } from '../session/admin-session.service.js';
import { AdminLoginService } from './admin-login.service.js';
import { LoginRateLimitGuard } from './login-rate-limit.js';

/** The BFF keeps the token in its `dormduri_bo_session` cookie and never shows it to the page. */
export function sessionResponse(session: IssuedSession) {
  return {
    session: {
      token: session.token,
      scope: session.scope,
      absoluteExpiresAt: session.absoluteExpiresAt.toISOString(),
    },
  };
}

@Controller('auth/login')
@UseGuards(LoginRateLimitGuard)
export class LoginController {
  constructor(@Inject(AdminLoginService) private readonly login: AdminLoginService) {}

  @Post('password')
  @PublicRoute()
  @HttpCode(200)
  password(
    @Body(new ZodPipe(loginPasswordRequestSchema)) body: LoginPasswordRequest,
    @RequestId() requestId: string,
  ) {
    return this.login.passwordStep(body, requestId);
  }

  @Post('passkey')
  @PublicRoute()
  @HttpCode(200)
  async passkey(
    @Body(new ZodPipe(loginPasskeyRequestSchema)) body: LoginPasskeyRequest,
    @RequestId() requestId: string,
  ) {
    return sessionResponse(await this.login.passkeyStep(body, requestId));
  }

  @Post('totp')
  @PublicRoute()
  @HttpCode(200)
  async totp(
    @Body(new ZodPipe(loginTotpRequestSchema)) body: LoginTotpRequest,
    @RequestId() requestId: string,
  ) {
    return sessionResponse(await this.login.totpStep(body, requestId));
  }

  @Post('recovery-code')
  @PublicRoute()
  @HttpCode(200)
  async recoveryCode(
    @Body(new ZodPipe(loginRecoveryCodeRequestSchema)) body: LoginRecoveryCodeRequest,
    @RequestId() requestId: string,
  ) {
    return sessionResponse(await this.login.recoveryCodeStep(body, requestId));
  }
}

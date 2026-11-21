import { Body, Controller, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import {
  registrationOptionsRequestSchema,
  registrationRequestSchema,
  type RegistrationOptionsRequest,
  type RegistrationRequest,
} from '@repo/shared/backoffice';
import { PublicRoute } from '../../access-control/route-access.js';
import { RequestId } from '../../platform/http/request-decorators.js';
import { ZodPipe } from '../../platform/http/zod-pipe.js';
import { sessionResponse } from '../login/login.controller.js';
import { LoginRateLimitGuard } from '../login/login-rate-limit.js';
import { AdminRegistrationService } from './admin-registration.service.js';

@Controller('auth/registration')
@UseGuards(LoginRateLimitGuard)
export class RegistrationController {
  constructor(
    @Inject(AdminRegistrationService) private readonly registration: AdminRegistrationService,
  ) {}

  @Post('options')
  @PublicRoute()
  @HttpCode(200)
  options(@Body(new ZodPipe(registrationOptionsRequestSchema)) body: RegistrationOptionsRequest) {
    return this.registration.options(body);
  }

  /** TOTP secret and recovery codes appear in this response only (shown once, README §3). */
  @Post()
  @PublicRoute()
  @HttpCode(200)
  async register(
    @Body(new ZodPipe(registrationRequestSchema)) body: RegistrationRequest,
    @RequestId() requestId: string,
  ) {
    const result = await this.registration.register(body, requestId);
    return {
      ...sessionResponse(result.session),
      accountId: result.accountId,
      totp: result.totp,
      recoveryCodes: result.recoveryCodes,
    };
  }
}

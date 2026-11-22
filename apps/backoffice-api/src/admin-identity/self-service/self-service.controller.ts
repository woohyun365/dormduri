import { Body, Controller, Get, HttpCode, Inject, Post } from '@nestjs/common';
import {
  passkeyRegistrationRequestSchema,
  reauthenticationRequestSchema,
  totpConfirmRequestSchema,
  type PasskeyRegistrationRequest,
  type ReauthenticationRequest,
  type TotpConfirmRequest,
} from '@repo/shared/backoffice';
import { SessionRoute } from '../../access-control/route-access.js';
import type { AdminRequestSession } from '../../platform/http/request-context.js';
import { CurrentSession, RequestId } from '../../platform/http/request-decorators.js';
import { ZodPipe } from '../../platform/http/zod-pipe.js';
import { AdminSelfService } from './admin-self-service.js';

@Controller('auth')
export class SelfServiceController {
  constructor(@Inject(AdminSelfService) private readonly self: AdminSelfService) {}

  @Get('session')
  @SessionRoute({ allowRecovery: true })
  session(@CurrentSession() session: AdminRequestSession) {
    return this.self.sessionInfo(session);
  }

  @Post('logout')
  @SessionRoute({ allowRecovery: true })
  @HttpCode(204)
  async logout(@CurrentSession() session: AdminRequestSession, @RequestId() requestId: string) {
    await this.self.logout(session, requestId);
  }

  @Post('reauthentication/options')
  @SessionRoute()
  @HttpCode(200)
  reauthenticationOptions(@CurrentSession() session: AdminRequestSession) {
    return this.self.reauthenticationOptions(session);
  }

  @Post('reauthentication')
  @SessionRoute()
  @HttpCode(200)
  reauthenticate(
    @CurrentSession() session: AdminRequestSession,
    @Body(new ZodPipe(reauthenticationRequestSchema)) body: ReauthenticationRequest,
    @RequestId() requestId: string,
  ) {
    return this.self.reauthenticate(session, body, requestId);
  }

  /** Recovery scope may add a passkey; a full session also needs a recent re-authentication. */
  @Post('passkeys/options')
  @SessionRoute({ allowRecovery: true })
  @HttpCode(200)
  passkeyOptions(@CurrentSession() session: AdminRequestSession) {
    return this.self.passkeyRegistrationOptions(session);
  }

  @Post('passkeys')
  @SessionRoute({ allowRecovery: true })
  @HttpCode(200)
  registerPasskey(
    @CurrentSession() session: AdminRequestSession,
    @Body(new ZodPipe(passkeyRegistrationRequestSchema)) body: PasskeyRegistrationRequest,
    @RequestId() requestId: string,
  ) {
    return this.self.registerPasskey(session, body, requestId);
  }

  @Post('totp/confirm')
  @SessionRoute()
  @HttpCode(204)
  async confirmTotp(
    @CurrentSession() session: AdminRequestSession,
    @Body(new ZodPipe(totpConfirmRequestSchema)) body: TotpConfirmRequest,
    @RequestId() requestId: string,
  ) {
    await this.self.confirmTotp(session, body, requestId);
  }

  @Post('totp')
  @SessionRoute({ reauthentication: true })
  @HttpCode(200)
  reissueTotp(@CurrentSession() session: AdminRequestSession, @RequestId() requestId: string) {
    return this.self.reissueTotp(session, requestId);
  }

  @Post('recovery-codes')
  @SessionRoute({ reauthentication: true })
  @HttpCode(200)
  async reissueRecoveryCodes(
    @CurrentSession() session: AdminRequestSession,
    @RequestId() requestId: string,
  ) {
    return { recoveryCodes: await this.self.reissueRecoveryCodes(session, requestId) };
  }
}

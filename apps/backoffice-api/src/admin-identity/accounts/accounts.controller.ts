import { Body, Controller, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import {
  accountDeactivateRequestSchema,
  invitationCreateRequestSchema,
  type AccountDeactivateRequest,
  type InvitationCreateRequest,
} from '@repo/shared/backoffice';
import { RequirePermission } from '../../access-control/route-access.js';
import type { AdminRequestSession } from '../../platform/http/request-context.js';
import { CurrentSession, RequestId } from '../../platform/http/request-decorators.js';
import { UuidParamPipe, ZodPipe } from '../../platform/http/zod-pipe.js';
import { AdminAccountsService } from './admin-accounts.service.js';

@Controller('accounts')
export class AccountsController {
  constructor(@Inject(AdminAccountsService) private readonly accounts: AdminAccountsService) {}

  /** Account emails and names are for the owner role only (§12 disclosure matrix). */
  @Get()
  @RequirePermission('admin:account:invite')
  list() {
    return this.accounts.list();
  }

  @Post('invitations')
  @RequirePermission('admin:account:invite')
  @HttpCode(200)
  invite(
    @CurrentSession() session: AdminRequestSession,
    @Body(new ZodPipe(invitationCreateRequestSchema)) body: InvitationCreateRequest,
    @RequestId() requestId: string,
  ) {
    return this.accounts.invite(session, body, requestId);
  }

  @Post('invitations/:invitationId/revoke')
  @RequirePermission('admin:account:invite')
  @HttpCode(204)
  async revokeInvitation(
    @CurrentSession() session: AdminRequestSession,
    @Param('invitationId', UuidParamPipe) invitationId: string,
    @RequestId() requestId: string,
  ) {
    await this.accounts.revokeInvitation(session, invitationId, requestId);
  }

  @Post(':accountId/deactivate')
  @RequirePermission('admin:account:deactivate', { reauthentication: true })
  @HttpCode(204)
  async deactivate(
    @CurrentSession() session: AdminRequestSession,
    @Param('accountId', UuidParamPipe) accountId: string,
    @Body(new ZodPipe(accountDeactivateRequestSchema)) body: AccountDeactivateRequest,
    @RequestId() requestId: string,
  ) {
    await this.accounts.deactivate(session, accountId, body, requestId);
  }
}

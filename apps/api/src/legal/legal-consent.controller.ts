import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  legalConsentRecordRequestSchema,
  type LegalConsentRecordRequest,
} from '@repo/shared/legal';
import { RequireCapability } from '../auth/access/auth-access.decorator.js';
import { CurrentUser } from '../auth/access/authenticated-user.decorator.js';
import type { AuthenticatedUserContext } from '../auth/application/auth-actor-context.types.js';
import { parseRequestBody } from '../platform/http/zod-request.js';
import { ZodRequestPipe } from '../platform/http/zod-request.pipe.js';
import { LegalReconsentCommand } from './commands/legal-reconsent.command.js';

/**
 * Reconsent routes. Unlike the class-level `@Public()` LegalController they need a signed-in member
 * (auth access route matrix: protected, no extra capability).
 */
@Controller('api/legal/consents')
@RequireCapability()
export class LegalConsentController {
  constructor(private readonly reconsent: LegalReconsentCommand) {}

  @Get('pending')
  getPendingConsents(@CurrentUser() authUser: AuthenticatedUserContext) {
    return this.reconsent.getPending(authUser.id);
  }

  @Post()
  recordConsents(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Body(
      new ZodRequestPipe((body: unknown) =>
        parseRequestBody(legalConsentRecordRequestSchema, body),
      ),
    )
    body: LegalConsentRecordRequest,
  ) {
    return this.reconsent.record(authUser.id, body.documentVersionIds);
  }
}

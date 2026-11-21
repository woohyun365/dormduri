import { Body, Controller, Get, HttpCode, Inject, Post, Query } from '@nestjs/common';
import {
  auditEventsQuerySchema,
  auditReviewRequestSchema,
  type AuditEventsQuery,
  type AuditReviewRequest,
} from '@repo/shared/backoffice';
import { RequirePermission } from '../access-control/route-access.js';
import type { AdminRequestSession } from '../platform/http/request-context.js';
import { CurrentSession, RequestId } from '../platform/http/request-decorators.js';
import { ZodPipe } from '../platform/http/zod-pipe.js';
import { AdminAuditQueryService } from './admin-audit-query.service.js';

@Controller('audit')
export class AuditController {
  constructor(@Inject(AdminAuditQueryService) private readonly audit: AdminAuditQueryService) {}

  @Get('events')
  @RequirePermission('admin:audit:read')
  list(@Query(new ZodPipe(auditEventsQuerySchema)) query: AuditEventsQuery) {
    return this.audit.list(query);
  }

  /** Monthly check of the admin audit against the SSM session trail (OA-R8). */
  @Post('reviews')
  @RequirePermission('admin:audit:review')
  @HttpCode(200)
  review(
    @CurrentSession() session: AdminRequestSession,
    @Body(new ZodPipe(auditReviewRequestSchema)) body: AuditReviewRequest,
    @RequestId() requestId: string,
  ) {
    return this.audit.recordReview(session, body, requestId);
  }
}

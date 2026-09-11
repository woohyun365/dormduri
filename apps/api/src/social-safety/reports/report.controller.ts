import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  createReportRequestSchema,
  listReportsQuerySchema,
  type ListReportsQuery,
  type CreateReportRequest,
} from '@repo/shared/social-safety/report';
import { RequireCapability } from '../../auth/access/auth-access.decorator.js';
import { CurrentUser } from '../../auth/access/authenticated-user.decorator.js';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import { parseQueryObject, parseRequestBody } from '../../platform/http/zod-request.js';
import { ZodRequestPipe } from '../../platform/http/zod-request.pipe.js';
import { ReportIntakeService } from './application/report-intake.service.js';

@Controller('api/reports')
@RequireCapability()
export class ReportController {
  constructor(private readonly reportIntakeService: ReportIntakeService) {}

  @Get()
  async listOwn(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Query(
      new ZodRequestPipe((query: unknown) =>
        parseQueryObject(listReportsQuerySchema, query, {
          code: 'INVALID_REPORT_LIST_QUERY',
          errorMessage: '신고 내역 요청이 올바르지 않습니다.',
        }),
      ),
    )
    parsed: ListReportsQuery,
  ) {
    return this.reportIntakeService.listOwn(authUser, parsed);
  }

  @Post()
  async create(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Body(
      new ZodRequestPipe((body: unknown) =>
        parseRequestBody(
          createReportRequestSchema,
          body ?? {},
          '신고 요청 본문이 올바르지 않습니다.',
        ),
      ),
    )
    parsed: CreateReportRequest,
  ) {
    return this.reportIntakeService.create(authUser, parsed);
  }
}

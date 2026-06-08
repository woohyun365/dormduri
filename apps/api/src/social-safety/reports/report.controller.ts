import { Body, Controller, Post } from '@nestjs/common';
import { createReportRequestSchema } from '@repo/shared/social-safety/report';
import { RequireCapability } from '../../auth/access/auth-access.decorator.js';
import { CurrentUser } from '../../auth/access/authenticated-user.decorator.js';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import { parseRequestBody } from '../../platform/http/zod-request.js';
import { ReportIntakeService } from './application/report-intake.service.js';

@Controller('api/reports')
@RequireCapability()
export class ReportController {
  constructor(private readonly reportIntakeService: ReportIntakeService) {}

  @Post()
  async create(@CurrentUser() authUser: AuthenticatedUserContext, @Body() body: unknown) {
    const parsed = parseRequestBody(
      createReportRequestSchema,
      body ?? {},
      '신고 요청 본문이 올바르지 않습니다.',
    );
    return this.reportIntakeService.create(authUser, parsed);
  }
}

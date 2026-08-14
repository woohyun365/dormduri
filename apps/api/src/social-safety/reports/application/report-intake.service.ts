import { Injectable } from '@nestjs/common';
import type {
  CreateReportRequest,
  CreateReportResponse,
  ListReportsQuery,
  ReportListResponse,
} from '@repo/shared/social-safety/report';
import type { AuthenticatedUserContext } from '../../../auth/application/auth-actor-context.types.js';
import { CreateReportCommand } from '../commands/create-report.command.js';
import { ReportListQuery } from '../queries/report-list.query.js';

@Injectable()
export class ReportIntakeService {
  constructor(
    private readonly createReportCommand: CreateReportCommand,
    private readonly reportListQuery: ReportListQuery,
  ) {}

  create(
    authUser: AuthenticatedUserContext,
    request: CreateReportRequest,
  ): Promise<CreateReportResponse> {
    return this.createReportCommand.execute({ authUser, request });
  }

  listOwn(
    authUser: AuthenticatedUserContext,
    query: ListReportsQuery,
  ): Promise<ReportListResponse> {
    return this.reportListQuery.listOwn(authUser, query);
  }
}

import { Injectable } from '@nestjs/common';
import type { ListReportsQuery, ReportListResponse } from '@repo/shared/social-safety/report';
import type { AuthenticatedUserContext } from '../../../auth/application/auth-actor-context.types.js';
import { ReportPresenter } from '../presenters/report.presenter.js';
import { ReportRepository } from '../repositories/report.repository.js';
import { decodeReportListCursor } from './report-list.cursor.js';

@Injectable()
export class ReportListQuery {
  constructor(
    private readonly repository: ReportRepository,
    private readonly presenter: ReportPresenter,
  ) {}

  async listOwn(
    authUser: AuthenticatedUserContext,
    query: ListReportsQuery,
  ): Promise<ReportListResponse> {
    const records = await this.repository.findForReporter({
      reporterUserId: authUser.id,
      cursor: decodeReportListCursor(query.cursor),
      limit: query.limit,
    });
    return this.presenter.toListResponse({ records, limit: query.limit });
  }
}

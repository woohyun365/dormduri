import { Injectable } from '@nestjs/common';
import type {
  CreateReportResponse,
  ReportOptionalActionResult,
} from '@repo/shared/social-safety/report';
import type { ReportCaseRecord } from '../repositories/report.repository.js';

@Injectable()
export class ReportPresenter {
  toCreateResponse(input: {
    report: ReportCaseRecord;
    received: boolean;
    optionalActionResult: ReportOptionalActionResult | null;
  }): CreateReportResponse {
    return {
      report: {
        id: input.report.id,
        targetType: input.report.targetType,
        reason: input.report.reason,
        receivedAt: input.report.receivedAt.toISOString(),
        status: 'RECEIVED',
      },
      received: input.received,
      optionalActionResult: input.optionalActionResult,
    };
  }
}

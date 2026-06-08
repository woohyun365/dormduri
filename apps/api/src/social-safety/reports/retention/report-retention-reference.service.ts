import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';

@Injectable()
export class ReportRetentionReferenceService {
  async appendReportReference(
    tx: Prisma.TransactionClient,
    input: {
      reportCaseId: string;
      reporterUserId: string;
      occurredAt: Date;
    },
  ): Promise<{ retentionCaseId: string }> {
    const retentionCase = await tx.retentionCase.create({
      data: {
        reason: 'REPORT_REVIEW',
        triggerUserId: input.reporterUserId,
        sourceTable: 'ReportCase',
        sourceId: input.reportCaseId,
        policyVersion: 'social-safety-report-intake-2026-06-08',
        metadata: {
          owner: 'social-safety/reports',
          mode: 'reference-only',
          rawRrpdRestored: false,
        },
        createdAt: input.occurredAt,
        updatedAt: input.occurredAt,
      },
      select: { id: true },
    });

    return { retentionCaseId: retentionCase.id };
  }
}

import { Injectable } from '@nestjs/common';
import type { ReportOptionalActionResult } from '@repo/shared/social-safety/report';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { ReportCaseEventType } from '../../../generated/prisma/enums.js';
import type { ReportListCursor } from '../queries/report-list.cursor.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';

export const reportCaseRecordSelect = {
  id: true,
  reporterUserId: true,
  targetType: true,
  targetId: true,
  targetUserId: true,
  targetParticipantId: true,
  targetThreadId: true,
  targetMessageId: true,
  targetMatchRequestId: true,
  seasonId: true,
  reason: true,
  riskTier: true,
  status: true,
  detail: true,
  evidenceAttachmentIds: true,
  evidenceAttachmentPolicy: true,
  optionalBlockRequested: true,
  optionalBlockResult: true,
  falseReportDisclaimerAcceptedAt: true,
  targetSnapshot: true,
  receivedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type ReportCaseRecord = Prisma.ReportCaseGetPayload<{
  select: typeof reportCaseRecordSelect;
}>;

export type ReportRepositoryClient = Pick<
  Prisma.TransactionClient,
  'reportCase' | 'reportCaseEvent'
>;

@Injectable()
export class ReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  findForReporter(input: {
    reporterUserId: string;
    cursor: ReportListCursor | null;
    limit: number;
  }): Promise<ReportCaseRecord[]> {
    return this.prisma.reportCase.findMany({
      where: {
        reporterUserId: input.reporterUserId,
        ...(input.cursor ? reportListCursorWhere(input.cursor) : {}),
      },
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
      select: reportCaseRecordSelect,
    });
  }

  findOpenCase(input: {
    client?: ReportRepositoryClient;
    reporterUserId: string;
    targetType: ReportCaseRecord['targetType'];
    targetId: string;
    reason: ReportCaseRecord['reason'];
  }): Promise<ReportCaseRecord | null> {
    const client = input.client ?? this.prisma;
    return client.reportCase.findFirst({
      where: {
        reporterUserId: input.reporterUserId,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        status: { in: ['SUBMITTED', 'EVIDENCE_ONLY'] },
      },
      select: reportCaseRecordSelect,
    });
  }

  create(input: {
    client: ReportRepositoryClient;
    reporterUserId: string;
    targetType: ReportCaseRecord['targetType'];
    targetId: string;
    targetUserId: string | null;
    targetParticipantId: string | null;
    targetThreadId: string | null;
    targetMessageId: string | null;
    targetMatchRequestId: string | null;
    seasonId: string | null;
    reason: ReportCaseRecord['reason'];
    riskTier: ReportCaseRecord['riskTier'];
    status: ReportCaseRecord['status'];
    detail: string | null;
    evidenceAttachmentIds: readonly string[];
    evidenceAttachmentPolicy: string;
    optionalBlockRequested: boolean;
    falseReportDisclaimerAcceptedAt: Date;
    targetSnapshot: Prisma.InputJsonValue;
    now: Date;
  }): Promise<ReportCaseRecord> {
    return input.client.reportCase.create({
      data: {
        reporterUserId: input.reporterUserId,
        targetType: input.targetType,
        targetId: input.targetId,
        targetUserId: input.targetUserId,
        targetParticipantId: input.targetParticipantId,
        targetThreadId: input.targetThreadId,
        targetMessageId: input.targetMessageId,
        targetMatchRequestId: input.targetMatchRequestId,
        seasonId: input.seasonId,
        reason: input.reason,
        riskTier: input.riskTier,
        status: input.status,
        detail: input.detail,
        evidenceAttachmentIds: [...input.evidenceAttachmentIds],
        evidenceAttachmentPolicy: input.evidenceAttachmentPolicy,
        optionalBlockRequested: input.optionalBlockRequested,
        falseReportDisclaimerAcceptedAt: input.falseReportDisclaimerAcceptedAt,
        targetSnapshot: input.targetSnapshot,
        receivedAt: input.now,
        createdAt: input.now,
        updatedAt: input.now,
      },
      select: reportCaseRecordSelect,
    });
  }

  updateOptionalBlockResult(input: {
    reportCaseId: string;
    result: ReportOptionalActionResult;
    now: Date;
    client?: ReportRepositoryClient;
  }): Promise<ReportCaseRecord> {
    const client = input.client ?? this.prisma;
    return client.reportCase.update({
      where: { id: input.reportCaseId },
      data: {
        optionalBlockResult: input.result,
        updatedAt: input.now,
      },
      select: reportCaseRecordSelect,
    });
  }

  appendEvent(input: {
    client: ReportRepositoryClient;
    reportCaseId: string;
    actorUserId: string | null;
    actorType?: 'USER' | 'SYSTEM';
    eventType: ReportCaseEventType;
    metadata?: Prisma.InputJsonValue;
    now: Date;
  }): Promise<void> {
    return input.client.reportCaseEvent
      .create({
        data: {
          reportCaseId: input.reportCaseId,
          actorUserId: input.actorUserId,
          actorType: input.actorType ?? (input.actorUserId ? 'USER' : 'SYSTEM'),
          eventType: input.eventType,
          metadata: input.metadata ?? undefined,
          occurredAt: input.now,
          createdAt: input.now,
        },
        select: { id: true },
      })
      .then(() => undefined);
  }
}

function reportListCursorWhere(cursor: ReportListCursor): Prisma.ReportCaseWhereInput {
  return {
    OR: [
      { receivedAt: { lt: cursor.receivedAt } },
      { receivedAt: cursor.receivedAt, id: { lt: cursor.id } },
    ],
  };
}

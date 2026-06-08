import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { OperatorAlertSeverity, ReportRiskTier } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import {
  OPERATOR_ALERT_SINK,
  type OperatorAlertSinkPort,
} from '../operator-alerts/operator-alert-sink.port.js';
import {
  toOperatorAlertRecordPayload,
  type OperatorAlertRecordPayload,
} from '../operator-alerts/operator-alert-payload.policy.js';

const DEFAULT_OPERATOR_ALERT_LIMIT = 50;

@Injectable()
export class MaterializeReportOperatorAlertCommand {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OPERATOR_ALERT_SINK)
    private readonly sink: OperatorAlertSinkPort,
  ) {}

  async execute(input: { limit?: number } = {}) {
    const limit = input.limit ?? DEFAULT_OPERATOR_ALERT_LIMIT;
    const candidates = await this.prisma.reportCaseEvent.findMany({
      where: {
        eventType: 'HIGH_RISK_ALERT_CANDIDATE_RECORDED',
      },
      select: {
        id: true,
        occurredAt: true,
        reportCase: {
          select: {
            id: true,
            riskTier: true,
          },
        },
      },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });

    let createdCount = 0;
    let skippedCount = 0;
    let deliveredCount = 0;

    for (const candidate of candidates) {
      const payload = toOperatorAlertRecordPayload({
        sourceId: candidate.reportCase.id,
        sourceType: 'REPORT_CASE',
        category: 'HIGH_RISK_REPORT',
        riskTier: candidate.reportCase.riskTier,
        severity: toOperatorAlertSeverity(candidate.reportCase.riskTier),
        occurredAt: candidate.occurredAt.toISOString(),
      });

      const alert = await this.createAlertIfMissing(payload);
      if (!alert.created) {
        skippedCount += 1;
        continue;
      }
      createdCount += 1;

      const sinkPayload = { ...payload, alertId: alert.alertId };
      const result = await this.sink.dispatch(sinkPayload);
      const dispatchedAt = await this.prisma.getDatabaseNow();
      if (result.delivered) {
        deliveredCount += 1;
        await this.prisma.operatorAlert.update({
          where: { id: alert.alertId },
          data: {
            status: 'DISPATCHED',
            deliveredAt: dispatchedAt,
            deliveryAttempts: { increment: 1 },
            updatedAt: dispatchedAt,
          },
        });
      } else {
        await this.prisma.operatorAlert.update({
          where: { id: alert.alertId },
          data: {
            status: result.skippedReason === 'EXTERNAL_SINK_DISABLED' ? 'SKIPPED' : 'FAILED',
            deliveryAttempts: { increment: 1 },
            lastError: result.errorMessage ?? result.skippedReason ?? null,
            updatedAt: dispatchedAt,
          },
        });
      }
    }

    return { processedCount: candidates.length, createdCount, skippedCount, deliveredCount };
  }

  private async createAlertIfMissing(input: OperatorAlertRecordPayload) {
    try {
      const alert = await this.prisma.operatorAlert.create({
        data: {
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          category: input.category,
          riskTier: input.riskTier,
          severity: input.severity,
          status: 'PENDING',
          payload: {
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            category: input.category,
            riskTier: input.riskTier,
            severity: input.severity,
            occurredAt: input.occurredAt,
          },
        },
        select: { id: true },
      });
      return { alertId: alert.id, created: true };
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
      const existing = await this.prisma.operatorAlert.findUniqueOrThrow({
        where: {
          sourceType_sourceId_category: {
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            category: input.category,
          },
        },
        select: { id: true },
      });
      return { alertId: existing.id, created: false };
    }
  }
}

function toOperatorAlertSeverity(riskTier: ReportRiskTier | null): OperatorAlertSeverity {
  return riskTier === 'HIGH' ? 'CRITICAL' : 'WARNING';
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

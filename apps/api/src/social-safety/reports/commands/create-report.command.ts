import { HttpException, Injectable } from '@nestjs/common';
import type {
  CreateReportRequest,
  CreateReportResponse,
  ReportOptionalActionResult,
} from '@repo/shared/social-safety/report';
import type { AuthenticatedUserContext } from '../../../auth/application/auth-actor-context.types.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { BlockService } from '../../blocks/application/block.service.js';
import {
  REPORT_ATTACHMENT_POLICY_UNVERIFIED_POINTERS,
  resolveReportAttachmentPolicy,
} from '../policies/report-attachment.policy.js';
import { shouldRecordProfileMismatchFeedbackCandidate } from '../policies/report-profile-feedback.policy.js';
import {
  resolveReportRiskTier,
  shouldRecordHighRiskAlertCandidate,
} from '../policies/report-risk.policy.js';
import { ReportPresenter } from '../presenters/report.presenter.js';
import { ReportNotificationService } from '../notifications/report-notification.service.js';
import { ReportRepository, type ReportCaseRecord } from '../repositories/report.repository.js';
import { ReportTargetContextResolver } from '../resolvers/report-target-context.resolver.js';
import { ReportRetentionReferenceService } from '../retention/report-retention-reference.service.js';

interface IntakeResult {
  report: ReportCaseRecord;
  received: boolean;
}

@Injectable()
export class CreateReportCommand {
  constructor(
    private readonly prisma: PrismaService,
    private readonly targetResolver: ReportTargetContextResolver,
    private readonly repository: ReportRepository,
    private readonly notificationService: ReportNotificationService,
    private readonly retentionReferenceService: ReportRetentionReferenceService,
    private readonly blockService: BlockService,
    private readonly presenter: ReportPresenter,
  ) {}

  async execute(input: {
    authUser: AuthenticatedUserContext;
    request: CreateReportRequest;
  }): Promise<CreateReportResponse> {
    const now = await this.prisma.getDatabaseNow();
    const intake = await this.createOrReplayReport(input.authUser, input.request, now);
    const optionalActionResult = await this.applyOptionalAction({
      authUser: input.authUser,
      report: intake.report,
      request: input.request,
      now,
    });

    const report = optionalActionResult
      ? await this.recordOptionalActionResult({
          reportCaseId: intake.report.id,
          result: optionalActionResult,
          now,
        })
      : intake.report;

    return this.presenter.toCreateResponse({
      report,
      received: intake.received,
      optionalActionResult,
    });
  }

  private async createOrReplayReport(
    authUser: AuthenticatedUserContext,
    request: CreateReportRequest,
    now: Date,
  ): Promise<IntakeResult> {
    try {
      return await this.prisma.runSerializableTransaction(async (tx) => {
        const target = await this.targetResolver.resolve({
          authUser,
          targetType: request.targetType,
          targetId: request.targetId,
          client: tx,
        });
        const existing = await this.repository.findOpenCase({
          client: tx,
          reporterUserId: authUser.id,
          targetType: target.targetType,
          targetId: target.targetId,
          reason: request.reason,
        });
        if (existing) {
          await this.repository.appendEvent({
            client: tx,
            reportCaseId: existing.id,
            actorUserId: authUser.id,
            eventType: 'REPORT_REPLAYED',
            metadata: {
              targetType: request.targetType,
              targetId: request.targetId,
              reason: request.reason,
            },
            now,
          });
          return { report: existing, received: false };
        }

        const evidenceAttachmentIds = request.evidenceAttachmentIds ?? [];
        const evidenceAttachmentPolicy = resolveReportAttachmentPolicy(evidenceAttachmentIds);
        const report = await this.repository.create({
          client: tx,
          reporterUserId: authUser.id,
          targetType: target.targetType,
          targetId: target.targetId,
          targetUserId: target.targetUserId,
          targetParticipantId: target.targetParticipantId,
          targetThreadId: target.targetThreadId,
          targetMessageId: target.targetMessageId,
          targetMatchRequestId: target.targetMatchRequestId,
          seasonId: target.seasonId,
          reason: request.reason,
          riskTier: resolveReportRiskTier(request.reason),
          status: target.status,
          detail: request.detail ?? null,
          evidenceAttachmentIds,
          evidenceAttachmentPolicy,
          optionalBlockRequested: request.optionalAction === 'BLOCK_TARGET',
          falseReportDisclaimerAcceptedAt: now,
          targetSnapshot: target.snapshot,
          now,
        });

        await this.repository.appendEvent({
          client: tx,
          reportCaseId: report.id,
          actorUserId: authUser.id,
          eventType: 'REPORT_SUBMITTED',
          metadata: {
            targetType: report.targetType,
            targetId: report.targetId,
            reason: report.reason,
            riskTier: report.riskTier,
          },
          now,
        });

        if (evidenceAttachmentPolicy === REPORT_ATTACHMENT_POLICY_UNVERIFIED_POINTERS) {
          await this.repository.appendEvent({
            client: tx,
            reportCaseId: report.id,
            actorUserId: authUser.id,
            eventType: 'UNVERIFIED_ATTACHMENT_POINTERS_RECORDED',
            metadata: { evidenceAttachmentIds },
            now,
          });
        }

        if (shouldRecordHighRiskAlertCandidate(request.reason)) {
          await this.repository.appendEvent({
            client: tx,
            reportCaseId: report.id,
            actorUserId: null,
            actorType: 'SYSTEM',
            eventType: 'HIGH_RISK_ALERT_CANDIDATE_RECORDED',
            metadata: { riskTier: report.riskTier, externalDelivery: false },
            now,
          });
        }

        if (
          shouldRecordProfileMismatchFeedbackCandidate({
            reason: request.reason,
            targetType: request.targetType,
          })
        ) {
          await this.repository.appendEvent({
            client: tx,
            reportCaseId: report.id,
            actorUserId: null,
            actorType: 'SYSTEM',
            eventType: 'PROFILE_MISMATCH_FEEDBACK_CANDIDATE_RECORDED',
            now,
          });
        }

        const retention = await this.retentionReferenceService.appendReportReference(tx, {
          reportCaseId: report.id,
          reporterUserId: authUser.id,
          occurredAt: now,
        });
        await this.repository.appendEvent({
          client: tx,
          reportCaseId: report.id,
          actorUserId: null,
          actorType: 'SYSTEM',
          eventType: 'RETENTION_REFERENCE_RECORDED',
          metadata: retention,
          now,
        });

        const receipt = await this.notificationService.appendReporterReceipt(tx, {
          reportCaseId: report.id,
          reporterUserId: authUser.id,
          occurredAt: now,
        });
        await this.repository.appendEvent({
          client: tx,
          reportCaseId: report.id,
          actorUserId: null,
          actorType: 'SYSTEM',
          eventType: 'REPORT_RECEIPT_NOTIFICATION_QUEUED',
          metadata: {
            notificationId: receipt.notificationId,
            created: receipt.created,
          },
          now,
        });

        return { report, received: true };
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const existing = await this.repository.findOpenCase({
        reporterUserId: authUser.id,
        targetType: request.targetType,
        targetId: request.targetId,
        reason: request.reason,
      });
      if (!existing) {
        throw error;
      }
      return { report: existing, received: false };
    }
  }

  private async applyOptionalAction(input: {
    authUser: AuthenticatedUserContext;
    report: ReportCaseRecord;
    request: CreateReportRequest;
    now: Date;
  }): Promise<ReportOptionalActionResult | null> {
    if (input.request.optionalAction !== 'BLOCK_TARGET') {
      return null;
    }

    if (!input.report.targetUserId || input.report.targetUserId === input.authUser.id) {
      return {
        action: 'BLOCK_TARGET',
        status: 'SKIPPED',
        code: 'REPORT_TARGET_HAS_NO_BLOCKABLE_USER',
      };
    }

    try {
      const response = await this.blockService.create(input.authUser, input.report.targetUserId, {
        note: null,
      });
      return {
        action: 'BLOCK_TARGET',
        status: 'SUCCEEDED',
        code: response.created ? 'BLOCK_CREATED' : 'BLOCK_ALREADY_ACTIVE',
      };
    } catch (error) {
      return {
        action: 'BLOCK_TARGET',
        status: 'FAILED',
        code: getApiErrorCode(error),
      };
    }
  }

  private async recordOptionalActionResult(input: {
    reportCaseId: string;
    result: ReportOptionalActionResult;
    now: Date;
  }): Promise<ReportCaseRecord> {
    return this.prisma.runSerializableTransaction(async (tx) => {
      const report = await this.repository.updateOptionalBlockResult({
        client: tx,
        reportCaseId: input.reportCaseId,
        result: input.result,
        now: input.now,
      });
      await this.repository.appendEvent({
        client: tx,
        reportCaseId: input.reportCaseId,
        actorUserId: null,
        actorType: 'SYSTEM',
        eventType: 'OPTIONAL_BLOCK_RESULT_RECORDED',
        metadata: {
          action: input.result.action,
          status: input.result.status,
          code: input.result.code ?? null,
        },
        now: input.now,
      });
      return report;
    });
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function getApiErrorCode(error: unknown): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === 'object' && response !== null && 'code' in response) {
      const code = (response as { code?: unknown }).code;
      return typeof code === 'string' ? code : 'OPTIONAL_BLOCK_FAILED';
    }
  }

  return 'OPTIONAL_BLOCK_FAILED';
}

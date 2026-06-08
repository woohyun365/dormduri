import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../platform/database/prisma.service.js';
import {
  NOTIFICATION_WRITER,
  type NotificationWriterPort,
} from '../application/ports/notification-writer.port.js';
import { toProfileMismatchFeedbackNotificationPayload } from '../policies/notification-payload.policy.js';

const DEFAULT_PROFILE_MISMATCH_LIMIT = 50;

@Injectable()
export class MaterializeProfileMismatchFeedbackCommand {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_WRITER)
    private readonly notificationWriter: NotificationWriterPort,
  ) {}

  async execute(input: { limit?: number } = {}) {
    const limit = input.limit ?? DEFAULT_PROFILE_MISMATCH_LIMIT;
    const candidates = await this.prisma.reportCaseEvent.findMany({
      where: {
        eventType: 'PROFILE_MISMATCH_FEEDBACK_CANDIDATE_RECORDED',
        reportCase: { targetUserId: { not: null } },
      },
      select: {
        id: true,
        occurredAt: true,
        reportCase: {
          select: {
            id: true,
            targetUserId: true,
          },
        },
      },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });

    let createdCount = 0;
    let skippedCount = 0;

    for (const candidate of candidates) {
      const targetUserId = candidate.reportCase.targetUserId;
      if (!targetUserId) {
        skippedCount += 1;
        continue;
      }

      const targetUser = await this.prisma.user.findFirst({
        where: { id: targetUserId, deletedAt: null },
        select: { id: true },
      });
      if (!targetUser) {
        skippedCount += 1;
        continue;
      }

      const result = await this.prisma.runSerializableTransaction((tx) =>
        this.notificationWriter.appendNotification(tx, {
          recipientUserId: targetUser.id,
          actorUserId: targetUser.id,
          kind: 'PROFILE_MISMATCH_FEEDBACK',
          sourceType: 'REPORT_CASE',
          sourceId: candidate.reportCase.id,
          payload: toProfileMismatchFeedbackNotificationPayload({
            reportId: candidate.reportCase.id,
            occurredAt: candidate.occurredAt,
          }),
          occurredAt: candidate.occurredAt,
        }),
      );

      if (result.created) {
        createdCount += 1;
      } else {
        skippedCount += 1;
      }
    }

    return { processedCount: candidates.length, createdCount, skippedCount };
  }
}

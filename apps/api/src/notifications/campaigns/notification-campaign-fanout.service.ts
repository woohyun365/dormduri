import { Inject, Injectable } from '@nestjs/common';
import {
  notificationKindSchema,
  notificationPayloadSchema,
  notificationSourceTypeSchema,
} from '@repo/shared/notification-contract';
import { PrismaService } from '../../platform/database/prisma.service.js';
import {
  NOTIFICATION_WRITER,
  type NotificationWriterPort,
} from '../application/ports/notification-writer.port.js';
import { normalizeNotificationCampaignChunkSize } from './notification-campaign-bounds.js';

@Injectable()
export class NotificationCampaignFanoutService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_WRITER)
    private readonly notificationWriter: NotificationWriterPort,
  ) {}

  async fanoutNextChunk(campaignId: string) {
    const now = await this.prisma.getDatabaseNow();
    const campaign = await this.prisma.notificationCampaign.findUniqueOrThrow({
      where: { id: campaignId },
      select: {
        id: true,
        kind: true,
        sourceType: true,
        sourceId: true,
        targetSeasonId: true,
        payload: true,
        cursorUserId: true,
        chunkSize: true,
        status: true,
      },
    });

    if (campaign.status === 'COMPLETED') {
      return { processedCount: 0, createdCount: 0, completed: true };
    }
    const kind = notificationKindSchema.parse(campaign.kind);
    const sourceType = notificationSourceTypeSchema.parse(campaign.sourceType);
    const payload = notificationPayloadSchema.parse(campaign.payload);
    const chunkSize = normalizeNotificationCampaignChunkSize(campaign.chunkSize);

    const recipients = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(campaign.cursorUserId ? { id: { gt: campaign.cursorUserId } } : {}),
        ...(campaign.targetSeasonId
          ? {
              seasonParticipants: {
                some: {
                  seasonId: campaign.targetSeasonId,
                  participantStatus: { in: ['ACTIVE', 'MATCHED'] },
                  hiddenByAdminAt: null,
                  deactivatedAt: null,
                  withdrawnAt: null,
                  expiredAt: null,
                },
              },
            }
          : {}),
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: chunkSize,
    });

    let createdCount = 0;
    for (const recipient of recipients) {
      const result = await this.prisma.runSerializableTransaction((tx) =>
        this.notificationWriter.appendNotification(tx, {
          recipientUserId: recipient.id,
          actorUserId: recipient.id,
          kind,
          sourceType,
          sourceId: campaign.id,
          payload,
          occurredAt: now,
        }),
      );
      if (result.created) {
        createdCount += 1;
      }
    }

    const lastRecipientId = recipients.at(-1)?.id ?? campaign.cursorUserId;
    const completed = recipients.length < chunkSize;
    await this.prisma.notificationCampaign.update({
      where: { id: campaign.id },
      data: {
        status: completed ? 'COMPLETED' : 'RUNNING',
        startedAt: campaign.status === 'PENDING' ? now : undefined,
        completedAt: completed ? now : undefined,
        cursorUserId: lastRecipientId,
        processedCount: { increment: recipients.length },
        enqueuedCount: { increment: createdCount },
        updatedAt: now,
      },
    });

    return { processedCount: recipients.length, createdCount, completed };
  }
}

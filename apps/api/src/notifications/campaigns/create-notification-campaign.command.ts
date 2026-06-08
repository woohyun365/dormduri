import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { NotificationKind, NotificationSourceType } from '@repo/shared/notification-contract';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { toSeasonSystemNoticeNotificationPayload } from '../policies/notification-payload.policy.js';
import { normalizeNotificationCampaignChunkSize } from './notification-campaign-bounds.js';

@Injectable()
export class CreateNotificationCampaignCommand {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: {
    sourceType: Extract<NotificationSourceType, 'SEASON' | 'SYSTEM'>;
    sourceId: string;
    noticeCode: string;
    seasonId?: string | null;
    chunkSize?: number;
  }) {
    const now = await this.prisma.getDatabaseNow();
    const campaignId = randomUUID();
    const kind: Extract<NotificationKind, 'SEASON_SYSTEM_NOTICE'> = 'SEASON_SYSTEM_NOTICE';
    const payload = toSeasonSystemNoticeNotificationPayload({
      campaignId,
      seasonId: input.seasonId ?? null,
      noticeCode: input.noticeCode,
      occurredAt: now,
    });

    try {
      const campaign = await this.prisma.notificationCampaign.create({
        data: {
          id: campaignId,
          kind,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          targetSeasonId: input.seasonId ?? null,
          payload,
          chunkSize: normalizeNotificationCampaignChunkSize(input.chunkSize),
          status: 'PENDING',
          createdAt: now,
          updatedAt: now,
        },
        select: { id: true },
      });
      return { campaignId: campaign.id, created: true };
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
      const existing = await this.prisma.notificationCampaign.findUniqueOrThrow({
        where: {
          kind_sourceType_sourceId: {
            kind,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
          },
        },
        select: { id: true },
      });
      return { campaignId: existing.id, created: false };
    }
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { notificationCreatedRealtimeEventSchema } from '@repo/shared/notification-contract';
import { PrismaService } from '../../platform/database/prisma.service.js';
import {
  REALTIME_DISPATCHER_CONFIG_PORT,
  REALTIME_DISPATCH_METRICS_PORT,
  type RealtimeDispatcherConfigPort,
  type RealtimeDispatchMetricsPort,
} from '../../realtime/realtime.tokens.js';
import {
  NOTIFICATION_REALTIME_PUBLISHER,
  type NotificationRealtimePublisherPort,
} from '../notifications.tokens.js';
import { isNotificationPayloadPrivacySafe } from '../policies/notification-payload.policy.js';
import {
  type ClaimedNotificationOutboxEvent,
  NotificationOutboxRepository,
} from './notification-outbox.repository.js';

export type NotificationDispatchResult = {
  claimedCount: number;
  publishedCount: number;
  failedCount: number;
  skippedReason: 'PUBLISHER_UNBOUND' | null;
};

@Injectable()
export class NotificationOutboxDispatcherService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationOutboxDispatcherService.name);
  private readonly repository = new NotificationOutboxRepository();
  private interval: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_REALTIME_PUBLISHER)
    private readonly publisher: NotificationRealtimePublisherPort,
    @Inject(REALTIME_DISPATCHER_CONFIG_PORT)
    private readonly settings: RealtimeDispatcherConfigPort,
    @Inject(REALTIME_DISPATCH_METRICS_PORT)
    @Optional()
    private readonly metrics?: RealtimeDispatchMetricsPort,
  ) {}

  onApplicationBootstrap() {
    if (!this.settings.dispatcherEnabled) {
      return;
    }

    this.interval = setInterval(() => {
      void this.dispatchOnce().catch((error) => {
        this.logger.warn(
          `[NotificationOutboxDispatcher] dispatch tick failed: ${toErrorMessage(error)}`,
        );
      });
    }, this.settings.dispatcherIntervalMs);
    this.interval.unref?.();
  }

  onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async dispatchOnce(now?: Date): Promise<NotificationDispatchResult> {
    if (this.running) {
      return { claimedCount: 0, publishedCount: 0, failedCount: 0, skippedReason: null };
    }

    if (!this.publisher.isBound()) {
      this.metrics?.recordDispatcherSkipped({
        dispatcher: 'notification',
        skippedReason: 'PUBLISHER_UNBOUND',
        now: now ?? new Date(),
      });
      return {
        claimedCount: 0,
        publishedCount: 0,
        failedCount: 0,
        skippedReason: 'PUBLISHER_UNBOUND',
      };
    }

    this.running = true;
    try {
      const databaseNow = now ?? (await this.prisma.getDatabaseNow());
      const claimed = await this.repository.claimPublishableBatch(this.prisma, {
        limit: this.settings.dispatcherBatchSize,
        now: databaseNow,
        claimLeaseMs: this.settings.dispatcherClaimLeaseMs,
      });

      let publishedCount = 0;
      let failedCount = 0;

      for (const event of claimed) {
        try {
          const realtimeEvent = toNotificationCreatedRealtimeEvent(event);
          this.publisher.publishNotificationCreated({
            recipientUserId: event.recipientUserId,
            event: realtimeEvent,
          });
          await this.repository.markPublished(this.prisma, {
            eventId: event.id,
            now: databaseNow,
          });
          publishedCount += 1;
        } catch (error) {
          const nextAvailableAt = new Date(
            databaseNow.getTime() + this.resolveRetryDelayMs(event.publishAttempts),
          );
          const errorMessage = toErrorMessage(error);
          await this.repository.markPublishFailed(this.prisma, {
            eventId: event.id,
            now: databaseNow,
            nextAvailableAt,
            error: errorMessage,
          });
          this.metrics?.recordPublishFailure('notification');
          failedCount += 1;
          this.logger.warn(
            `[NotificationOutboxDispatcher] publish failed eventId=${event.id} eventType=${event.eventType} attempts=${event.publishAttempts} errorType=${toErrorLogType(error)}`,
          );
        }
      }

      this.metrics?.recordDispatcherBatch({
        dispatcher: 'notification',
        claimedCount: claimed.length,
        publishedCount,
        failedCount,
        oldestOccurredAt: claimed[0]?.createdAt ?? null,
        now: databaseNow,
      });

      return {
        claimedCount: claimed.length,
        publishedCount,
        failedCount,
        skippedReason: null,
      };
    } finally {
      this.running = false;
    }
  }

  private resolveRetryDelayMs(publishAttempts: number) {
    const exponent = Math.max(0, Math.min(publishAttempts - 1, 8));
    return Math.min(
      this.settings.dispatcherRetryMaxMs,
      this.settings.dispatcherRetryBaseMs * 2 ** exponent,
    );
  }
}

function toNotificationCreatedRealtimeEvent(event: ClaimedNotificationOutboxEvent) {
  if (event.eventType !== 'notification.created' || event.schemaVersion !== 1) {
    throw new Error('[NotificationOutboxDispatcher] unsupported event type or schema version');
  }
  if (!isNotificationPayloadPrivacySafe(event.payload)) {
    throw new Error('[NotificationOutboxDispatcher] unsafe notification payload');
  }

  return notificationCreatedRealtimeEventSchema.parse({
    schemaVersion: 1,
    eventId: event.id,
    eventType: 'notification.created',
    occurredAt: event.createdAt.toISOString(),
    cursor: event.id,
    payload: event.payload,
  });
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function toErrorLogType(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}

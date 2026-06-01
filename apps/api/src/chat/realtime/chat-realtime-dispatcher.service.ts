import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import chatRealtimeConfig from '../../config/chat-realtime.config.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { ChatRealtimeOutboxRepository } from '../outbox/chat-realtime-outbox.repository.js';
import { ChatRealtimeMetricsService } from './chat-realtime.metrics.js';
import { ChatRealtimePublisher } from './chat-realtime-publisher.js';

export type ChatRealtimeDispatchResult = {
  claimedCount: number;
  publishedCount: number;
  failedCount: number;
  skippedReason: 'PUBLISHER_UNBOUND' | null;
};

@Injectable()
export class ChatRealtimeDispatcherService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ChatRealtimeDispatcherService.name);
  private readonly repository = new ChatRealtimeOutboxRepository();
  private interval: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: ChatRealtimePublisher,
    private readonly metrics: ChatRealtimeMetricsService,
    @Inject(chatRealtimeConfig.KEY)
    private readonly settings: ConfigType<typeof chatRealtimeConfig>,
  ) {}

  onApplicationBootstrap() {
    if (!this.settings.dispatcherEnabled) {
      return;
    }

    this.interval = setInterval(() => {
      void this.dispatchOnce().catch((error) => {
        this.logger.warn(`[ChatRealtimeDispatcher] dispatch tick failed: ${toErrorMessage(error)}`);
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

  async dispatchOnce(now?: Date): Promise<ChatRealtimeDispatchResult> {
    if (this.running) {
      return {
        claimedCount: 0,
        publishedCount: 0,
        failedCount: 0,
        skippedReason: null,
      };
    }

    if (!this.publisher.isBound()) {
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
      this.metrics.recordClaimedOutboxLag({
        oldestOccurredAt: claimed[0]?.occurredAt ?? null,
        now: databaseNow,
      });

      let publishedCount = 0;
      let failedCount = 0;

      for (const event of claimed) {
        try {
          const recipients = await this.repository.findRecipientsForEvent(this.prisma, {
            eventId: event.id,
          });
          this.publisher.publishOutboxEvent({ event, recipients });
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
          this.metrics.recordPublishFailure();
          failedCount += 1;
          this.logger.warn(
            `[ChatRealtimeDispatcher] publish failed eventId=${event.id} eventType=${event.eventType} attempts=${event.publishAttempts} errorType=${toErrorLogType(error)}`,
          );
        }
      }

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

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function toErrorLogType(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}

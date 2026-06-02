import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import {
  REALTIME_DISPATCHER_CONFIG_PORT,
  REALTIME_DISPATCH_METRICS_PORT,
  type RealtimeDispatcherConfigPort,
  type RealtimeDispatchMetricsPort,
} from '../../realtime/realtime.tokens.js';
import { ChatRealtimeOutboxRepository } from '../outbox/chat-realtime-outbox.repository.js';
import { ChatRealtimePublisher } from './chat-realtime-publisher.js';

const CHAT_REALTIME_REPLAY_WINDOW_DAYS = 7;
const CHAT_REALTIME_OUTBOX_PRUNE_INTERVAL_MS = 60 * 60 * 1_000;

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
  private lastPrunedAt: Date | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: ChatRealtimePublisher,
    @Inject(REALTIME_DISPATCH_METRICS_PORT)
    private readonly metrics: RealtimeDispatchMetricsPort,
    @Inject(REALTIME_DISPATCHER_CONFIG_PORT)
    private readonly settings: RealtimeDispatcherConfigPort,
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
      this.metrics.recordDispatcherSkipped({
        dispatcher: 'chat',
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
          this.metrics.recordPublishFailure('chat');
          failedCount += 1;
          this.logger.warn(
            `[ChatRealtimeDispatcher] publish failed eventId=${event.id} eventType=${event.eventType} attempts=${event.publishAttempts} errorType=${toErrorLogType(error)}`,
          );
        }
      }

      this.metrics.recordDispatcherBatch({
        dispatcher: 'chat',
        claimedCount: claimed.length,
        publishedCount,
        failedCount,
        oldestOccurredAt: claimed[0]?.occurredAt ?? null,
        now: databaseNow,
      });
      await this.pruneExpiredReplayWindowIfDue(databaseNow);

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

  private async pruneExpiredReplayWindowIfDue(now: Date) {
    if (
      this.lastPrunedAt &&
      now.getTime() - this.lastPrunedAt.getTime() < CHAT_REALTIME_OUTBOX_PRUNE_INTERVAL_MS
    ) {
      return;
    }

    try {
      const deletedCount = await this.repository.pruneExpired(this.prisma, {
        now,
        replayWindowDays: CHAT_REALTIME_REPLAY_WINDOW_DAYS,
      });
      this.lastPrunedAt = now;
      this.metrics.recordOutboxPrune({ deletedCount, now });
    } catch (error) {
      this.metrics.recordOutboxPruneFailure({ now });
      this.logger.warn(`[ChatRealtimeDispatcher] prune failed errorType=${toErrorLogType(error)}`);
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

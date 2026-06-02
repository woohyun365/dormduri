import { Injectable } from '@nestjs/common';
import type { ChatRealtimeReplayFailureReason } from '@repo/shared/chat-contract';
import type { ChatRealtimeRateLimitScope } from './chat-realtime-rate-limiter.service.js';

export type ChatRealtimeAuthFailureReason = 'ticket_invalid';
export type ChatRealtimeSubscribeRejectionReason = 'INVALID_REQUEST' | 'UNAUTHORIZED_THREAD';
export type ChatRealtimeDispatcherName = 'chat' | 'notification';
export type ChatRealtimeDispatcherSkippedReason = 'PUBLISHER_UNBOUND';

type DispatcherMetrics = {
  totalClaimed: number;
  totalPublished: number;
  totalFailed: number;
  totalSkippedPublisherUnbound: number;
  lastClaimedCount: number;
  lastPublishedCount: number;
  lastFailedCount: number;
  lastSkippedReason: ChatRealtimeDispatcherSkippedReason | null;
  lastRunAt: string | null;
  lastFailureAt: string | null;
  oldestClaimedOutboxLagSeconds: number;
};

type OutboxPruneMetrics = {
  totalDeleted: number;
  totalFailures: number;
  lastDeletedCount: number;
  lastPrunedAt: string | null;
  lastFailureAt: string | null;
};

function createDispatcherMetrics(): DispatcherMetrics {
  return {
    totalClaimed: 0,
    totalPublished: 0,
    totalFailed: 0,
    totalSkippedPublisherUnbound: 0,
    lastClaimedCount: 0,
    lastPublishedCount: 0,
    lastFailedCount: 0,
    lastSkippedReason: null,
    lastRunAt: null,
    lastFailureAt: null,
    oldestClaimedOutboxLagSeconds: 0,
  };
}

@Injectable()
export class ChatRealtimeMetricsService {
  private connectedSockets = 0;
  private totalConnections = 0;
  private publishFailures = 0;
  private oldestClaimedOutboxLagSeconds = 0;
  private readonly dispatcherMetrics: Record<ChatRealtimeDispatcherName, DispatcherMetrics> = {
    chat: createDispatcherMetrics(),
    notification: createDispatcherMetrics(),
  };
  private readonly replayResyncRequired = new Map<ChatRealtimeReplayFailureReason, number>();
  private readonly rateLimitRejections = new Map<ChatRealtimeRateLimitScope, number>();
  private readonly authFailures = new Map<ChatRealtimeAuthFailureReason, number>();
  private readonly subscribeRejections = new Map<ChatRealtimeSubscribeRejectionReason, number>();
  private readonly outboxPrune: OutboxPruneMetrics = {
    totalDeleted: 0,
    totalFailures: 0,
    lastDeletedCount: 0,
    lastPrunedAt: null,
    lastFailureAt: null,
  };

  recordSocketConnected() {
    this.connectedSockets += 1;
    this.totalConnections += 1;
  }

  recordSocketDisconnected() {
    this.connectedSockets = Math.max(0, this.connectedSockets - 1);
  }

  recordPublishFailure(dispatcher: ChatRealtimeDispatcherName = 'chat') {
    this.publishFailures += 1;
    this.dispatcherMetrics[dispatcher].lastFailureAt = new Date().toISOString();
  }

  recordRateLimitRejection(scope: ChatRealtimeRateLimitScope) {
    this.rateLimitRejections.set(scope, (this.rateLimitRejections.get(scope) ?? 0) + 1);
  }

  recordAuthFailure(reason: ChatRealtimeAuthFailureReason) {
    this.authFailures.set(reason, (this.authFailures.get(reason) ?? 0) + 1);
  }

  recordSubscribeRejection(reason: ChatRealtimeSubscribeRejectionReason) {
    this.subscribeRejections.set(reason, (this.subscribeRejections.get(reason) ?? 0) + 1);
  }

  recordReplayResyncRequired(reason: ChatRealtimeReplayFailureReason) {
    this.replayResyncRequired.set(reason, (this.replayResyncRequired.get(reason) ?? 0) + 1);
  }

  recordClaimedOutboxLag(input: { oldestOccurredAt: Date | null; now: Date }) {
    this.oldestClaimedOutboxLagSeconds = input.oldestOccurredAt
      ? Math.max(0, Math.floor((input.now.getTime() - input.oldestOccurredAt.getTime()) / 1000))
      : 0;
  }

  recordDispatcherSkipped(input: {
    dispatcher: ChatRealtimeDispatcherName;
    skippedReason: ChatRealtimeDispatcherSkippedReason;
    now: Date;
  }) {
    const metrics = this.dispatcherMetrics[input.dispatcher];
    metrics.totalSkippedPublisherUnbound += input.skippedReason === 'PUBLISHER_UNBOUND' ? 1 : 0;
    metrics.lastClaimedCount = 0;
    metrics.lastPublishedCount = 0;
    metrics.lastFailedCount = 0;
    metrics.lastSkippedReason = input.skippedReason;
    metrics.lastRunAt = input.now.toISOString();
    metrics.oldestClaimedOutboxLagSeconds = 0;
  }

  recordDispatcherBatch(input: {
    dispatcher: ChatRealtimeDispatcherName;
    claimedCount: number;
    publishedCount: number;
    failedCount: number;
    oldestOccurredAt: Date | null;
    now: Date;
  }) {
    const metrics = this.dispatcherMetrics[input.dispatcher];
    metrics.totalClaimed += input.claimedCount;
    metrics.totalPublished += input.publishedCount;
    metrics.totalFailed += input.failedCount;
    metrics.lastClaimedCount = input.claimedCount;
    metrics.lastPublishedCount = input.publishedCount;
    metrics.lastFailedCount = input.failedCount;
    metrics.lastSkippedReason = null;
    metrics.lastRunAt = input.now.toISOString();
    metrics.oldestClaimedOutboxLagSeconds = input.oldestOccurredAt
      ? Math.max(0, Math.floor((input.now.getTime() - input.oldestOccurredAt.getTime()) / 1000))
      : 0;
    if (input.failedCount > 0) {
      metrics.lastFailureAt = input.now.toISOString();
    }

    if (input.dispatcher === 'chat') {
      this.oldestClaimedOutboxLagSeconds = metrics.oldestClaimedOutboxLagSeconds;
    }
  }

  recordOutboxPrune(input: { deletedCount: number; now: Date }) {
    this.outboxPrune.totalDeleted += input.deletedCount;
    this.outboxPrune.lastDeletedCount = input.deletedCount;
    this.outboxPrune.lastPrunedAt = input.now.toISOString();
  }

  recordOutboxPruneFailure(input: { now: Date }) {
    this.outboxPrune.totalFailures += 1;
    this.outboxPrune.lastFailureAt = input.now.toISOString();
  }

  snapshot() {
    return {
      connectedSockets: this.connectedSockets,
      totalConnections: this.totalConnections,
      publishFailures: this.publishFailures,
      oldestClaimedOutboxLagSeconds: this.oldestClaimedOutboxLagSeconds,
      dispatchers: {
        chat: { ...this.dispatcherMetrics.chat },
        notification: { ...this.dispatcherMetrics.notification },
      },
      replayResyncRequired: Object.fromEntries(this.replayResyncRequired),
      outboxPrune: { ...this.outboxPrune },
      rateLimitRejections: Object.fromEntries(this.rateLimitRejections),
      authFailures: Object.fromEntries(this.authFailures),
      subscribeRejections: Object.fromEntries(this.subscribeRejections),
    };
  }
}

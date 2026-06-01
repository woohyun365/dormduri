import { Injectable } from '@nestjs/common';
import type { ChatRealtimeRateLimitScope } from './chat-realtime-rate-limiter.service.js';

@Injectable()
export class ChatRealtimeMetricsService {
  private connectedSockets = 0;
  private totalConnections = 0;
  private publishFailures = 0;
  private oldestClaimedOutboxLagSeconds = 0;
  private readonly rateLimitRejections = new Map<ChatRealtimeRateLimitScope, number>();

  recordSocketConnected() {
    this.connectedSockets += 1;
    this.totalConnections += 1;
  }

  recordSocketDisconnected() {
    this.connectedSockets = Math.max(0, this.connectedSockets - 1);
  }

  recordPublishFailure() {
    this.publishFailures += 1;
  }

  recordRateLimitRejection(scope: ChatRealtimeRateLimitScope) {
    this.rateLimitRejections.set(scope, (this.rateLimitRejections.get(scope) ?? 0) + 1);
  }

  recordClaimedOutboxLag(input: { oldestOccurredAt: Date | null; now: Date }) {
    this.oldestClaimedOutboxLagSeconds = input.oldestOccurredAt
      ? Math.max(0, Math.floor((input.now.getTime() - input.oldestOccurredAt.getTime()) / 1000))
      : 0;
  }

  snapshot() {
    return {
      connectedSockets: this.connectedSockets,
      totalConnections: this.totalConnections,
      publishFailures: this.publishFailures,
      oldestClaimedOutboxLagSeconds: this.oldestClaimedOutboxLagSeconds,
      rateLimitRejections: Object.fromEntries(this.rateLimitRejections),
    };
  }
}

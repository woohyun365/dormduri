import { Injectable } from '@nestjs/common';
import type { ChatRealtimeRateLimitScope } from './chat-realtime-rate-limiter.service.js';

export type ChatRealtimeAuthFailureReason = 'ticket_invalid';
export type ChatRealtimeSubscribeRejectionReason = 'INVALID_REQUEST' | 'UNAUTHORIZED_THREAD';

@Injectable()
export class ChatRealtimeMetricsService {
  private connectedSockets = 0;
  private totalConnections = 0;
  private publishFailures = 0;
  private oldestClaimedOutboxLagSeconds = 0;
  private readonly rateLimitRejections = new Map<ChatRealtimeRateLimitScope, number>();
  private readonly authFailures = new Map<ChatRealtimeAuthFailureReason, number>();
  private readonly subscribeRejections = new Map<ChatRealtimeSubscribeRejectionReason, number>();

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

  recordAuthFailure(reason: ChatRealtimeAuthFailureReason) {
    this.authFailures.set(reason, (this.authFailures.get(reason) ?? 0) + 1);
  }

  recordSubscribeRejection(reason: ChatRealtimeSubscribeRejectionReason) {
    this.subscribeRejections.set(reason, (this.subscribeRejections.get(reason) ?? 0) + 1);
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
      authFailures: Object.fromEntries(this.authFailures),
      subscribeRejections: Object.fromEntries(this.subscribeRejections),
    };
  }
}

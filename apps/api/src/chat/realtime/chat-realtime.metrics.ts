import { Injectable } from '@nestjs/common';

@Injectable()
export class ChatRealtimeMetricsService {
  private connectedSockets = 0;
  private totalConnections = 0;
  private publishFailures = 0;
  private oldestClaimedOutboxLagSeconds = 0;

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
    };
  }
}

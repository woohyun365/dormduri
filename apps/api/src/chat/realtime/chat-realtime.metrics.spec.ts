import { ChatRealtimeMetricsService } from './chat-realtime.metrics.js';

describe('ChatRealtimeMetricsService', () => {
  it('dispatcher, replay resync, prune, rate-limit failure를 이유별 snapshot으로 구분한다', () => {
    const metrics = new ChatRealtimeMetricsService();
    const now = new Date('2026-06-02T03:00:00.000Z');

    metrics.recordDispatcherBatch({
      dispatcher: 'chat',
      claimedCount: 3,
      publishedCount: 2,
      failedCount: 1,
      oldestOccurredAt: new Date('2026-06-02T02:59:10.000Z'),
      now,
    });
    metrics.recordDispatcherSkipped({
      dispatcher: 'notification',
      skippedReason: 'PUBLISHER_UNBOUND',
      now,
    });
    metrics.recordReplayResyncRequired('CURSOR_EXPIRED');
    metrics.recordReplayResyncRequired('SCHEMA_UNSUPPORTED');
    metrics.recordOutboxPrune({ deletedCount: 7, now });
    metrics.recordRateLimitRejection('chat:ticket:user');

    expect(metrics.snapshot()).toMatchObject({
      oldestClaimedOutboxLagSeconds: 50,
      dispatchers: {
        chat: {
          totalClaimed: 3,
          totalPublished: 2,
          totalFailed: 1,
          lastClaimedCount: 3,
          lastPublishedCount: 2,
          lastFailedCount: 1,
          lastRunAt: now.toISOString(),
          oldestClaimedOutboxLagSeconds: 50,
        },
        notification: {
          totalSkippedPublisherUnbound: 1,
          lastSkippedReason: 'PUBLISHER_UNBOUND',
          lastRunAt: now.toISOString(),
        },
      },
      replayResyncRequired: {
        CURSOR_EXPIRED: 1,
        SCHEMA_UNSUPPORTED: 1,
      },
      outboxPrune: {
        totalDeleted: 7,
        lastDeletedCount: 7,
        lastPrunedAt: now.toISOString(),
      },
      rateLimitRejections: {
        'chat:ticket:user': 1,
      },
    });
  });
});

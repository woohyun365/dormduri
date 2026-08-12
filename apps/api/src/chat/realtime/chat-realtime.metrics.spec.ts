import { describe, expect, it, vi } from 'vitest';
import type { DomainMetricsPort } from '../../platform/observability/metrics/domain-metrics.port.js';
import { ChatRealtimeMetricsService } from './chat-realtime.metrics.js';

describe('ChatRealtimeMetricsService', () => {
  it('dispatcher, replay resync, prune, rate-limit failure를 이유별 snapshot으로 구분한다', () => {
    const domainMetrics = makeDomainMetrics();
    const metrics = new ChatRealtimeMetricsService(domainMetrics);
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
    metrics.recordPublishFailure('chat');
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
    expect(domainMetrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_realtime_dispatch_batches_total',
      labels: { dispatcher: 'chat', outcome: 'failure' },
    });
    expect(domainMetrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_realtime_dispatch_batches_total',
      labels: { dispatcher: 'notification', outcome: 'PUBLISHER_UNBOUND' },
    });
    expect(domainMetrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_chat_realtime_outbox_prune_total',
      labels: { outcome: 'success' },
      value: 7,
    });
    expect(domainMetrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_chat_realtime_rejections_total',
      labels: { reason: 'rate_limit', scope: 'chat:ticket:user' },
    });
    expect(domainMetrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_chat_realtime_rejections_total',
      labels: { reason: 'CURSOR_EXPIRED', scope: 'replay' },
    });
    expect(domainMetrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_realtime_publish_failures_total',
      labels: { dispatcher: 'chat' },
    });
    expect(domainMetrics.setGauge).toHaveBeenCalledWith({
      name: 'api_realtime_dispatch_oldest_claimed_outbox_lag_seconds',
      labels: { dispatcher: 'chat' },
      value: 50,
    });
  });

  it('Prometheus bridge 기록 실패는 realtime snapshot 기록을 깨지 않는다', () => {
    const domainMetrics = makeDomainMetrics();
    domainMetrics.incrementCounter.mockImplementation(() => {
      throw new Error('metric rejected');
    });
    const metrics = new ChatRealtimeMetricsService(domainMetrics);

    expect(() => metrics.recordRateLimitRejection('chat:message:user')).not.toThrow();
    expect(metrics.snapshot().rateLimitRejections).toEqual({ 'chat:message:user': 1 });
  });
});

function makeDomainMetrics() {
  return {
    incrementCounter: vi.fn(),
    setGauge: vi.fn(),
    observeHistogram: vi.fn(),
  } satisfies DomainMetricsPort;
}

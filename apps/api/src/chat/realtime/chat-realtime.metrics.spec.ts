import { describe, expect, it, vi } from 'vitest';
import type { DomainMetricsPort } from '../../platform/observability/metrics/domain-metrics.port.js';
import { ChatRealtimeMetricsService } from './chat-realtime.metrics.js';

describe('ChatRealtimeMetricsService', () => {
  it('socket gauge/counter 이름과 instance-local accounting을 유지한다', () => {
    const bridge = makeDomainMetrics();
    const a = new ChatRealtimeMetricsService(bridge);
    const b = new ChatRealtimeMetricsService();
    a.recordSocketConnected();
    a.recordSocketConnected();
    b.recordSocketConnected();
    a.recordSocketDisconnected();
    a.recordSocketDisconnected();
    a.recordSocketDisconnected();
    expect(a.snapshot()).toMatchObject({ connectedSockets: 0, totalConnections: 2 });
    expect(b.snapshot()).toMatchObject({ connectedSockets: 1, totalConnections: 1 });
    expect(bridge.setGauge.mock.calls).toEqual(
      [1, 2, 1, 0, 0].map((value) => [{ name: 'api_chat_realtime_connected_sockets', value }]),
    );
    expect(bridge.incrementCounter.mock.calls).toEqual([
      [{ name: 'api_chat_realtime_connections_total' }],
      [{ name: 'api_chat_realtime_connections_total' }],
    ]);
  });

  it.each(['setGauge', 'incrementCounter'] as const)(
    '%s bridge 실패는 socket의 local gauge/counter를 깨지 않는다',
    (method) => {
      const bridge = makeDomainMetrics();
      bridge[method].mockImplementation(() => {
        throw new Error('metric rejected');
      });
      const metrics = new ChatRealtimeMetricsService(bridge);
      expect(() => metrics.recordSocketConnected()).not.toThrow();
      expect(metrics.snapshot()).toMatchObject({ connectedSockets: 1, totalConnections: 1 });
      expect(() => metrics.recordSocketDisconnected()).not.toThrow();
      expect(metrics.snapshot()).toMatchObject({ connectedSockets: 0, totalConnections: 1 });
    },
  );

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

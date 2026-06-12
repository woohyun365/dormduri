import { describe, expect, it } from 'vitest';
import {
  ChatRealtimeRateLimiterService,
  resolveChatRealtimeRequestIp,
} from './chat-realtime-rate-limiter.service.js';

function createSettings(overrides: Record<string, unknown> = {}) {
  return {
    allowedOrigins: false as const,
    trustProxy: false,
    dispatcherEnabled: false,
    dispatcherIntervalMs: 1_000,
    dispatcherBatchSize: 50,
    dispatcherClaimLeaseMs: 30_000,
    dispatcherRetryBaseMs: 1_000,
    dispatcherRetryMaxMs: 60_000,
    messageUserLimit: 2,
    messageUserWindowMs: 60_000,
    messagePairLimit: 2,
    messagePairWindowMs: 60_000,
    messageBurstLimit: 1,
    messageBurstWindowMs: 10_000,
    ticketUserLimit: 1,
    ticketUserWindowMs: 60_000,
    ticketIpLimit: 2,
    ticketIpWindowMs: 60_000,
    wsConnectIpLimit: 1,
    wsConnectIpWindowMs: 60_000,
    wsConnectUserLimit: 1,
    wsConnectUserWindowMs: 60_000,
    wsConcurrentUserLimit: 1,
    wsSubscribeSocketLimit: 2,
    wsSubscribeSocketWindowMs: 60_000,
    wsSubscribeFailureLimit: 1,
    wsSubscribeFailureWindowMs: 60_000,
    ...overrides,
  };
}

function createLimiter(overrides: Record<string, unknown> = {}) {
  let nowMs = 1_000;
  const limiter = new ChatRealtimeRateLimiterService(createSettings(overrides));
  limiter.setClockForTest(() => nowMs);

  return {
    limiter,
    advance: (ms: number) => {
      nowMs += ms;
    },
  };
}

describe('ChatRealtimeRateLimiterService', () => {
  it('message send는 user/pair/burst dimension을 모두 검사하고 window reset 후 허용한다', () => {
    const { limiter, advance } = createLimiter();

    expect(limiter.consumeMessageSend({ userId: 'user-1', targetUserId: 'user-2' })).toMatchObject({
      allowed: true,
    });
    expect(limiter.consumeMessageSend({ userId: 'user-1', targetUserId: 'user-2' })).toMatchObject({
      allowed: false,
      scope: 'chat:message:burst',
      retryAfterSeconds: 10,
    });

    advance(10_000);
    expect(limiter.consumeMessageSend({ userId: 'user-1', targetUserId: 'user-2' })).toMatchObject({
      allowed: true,
    });
  });

  it('ticket 발급은 user와 ip budget을 함께 소비한다', () => {
    const { limiter } = createLimiter();

    expect(limiter.consumeRealtimeTicket({ userId: 'user-1', ip: '203.0.113.1' })).toMatchObject({
      allowed: true,
    });
    expect(limiter.consumeRealtimeTicket({ userId: 'user-1', ip: '203.0.113.1' })).toMatchObject({
      allowed: false,
      scope: 'chat:ticket:user',
    });
  });

  it('gateway connect와 concurrent socket budget은 HTTP throttler와 별도로 관리한다', () => {
    const { limiter } = createLimiter();

    expect(limiter.consumeGatewayConnectIp({ ip: '203.0.113.2' })).toMatchObject({ allowed: true });
    expect(limiter.consumeGatewayConnectIp({ ip: '203.0.113.2' })).toMatchObject({
      allowed: false,
      scope: 'chat:ws:connect:ip',
    });
    expect(limiter.tryRegisterUserSocket({ userId: 'user-1' })).toMatchObject({ allowed: true });
    expect(limiter.tryRegisterUserSocket({ userId: 'user-1' })).toMatchObject({
      allowed: false,
      scope: 'chat:ws:connect:concurrent-user',
    });
    limiter.unregisterUserSocket({ userId: 'user-1' });
    expect(limiter.tryRegisterUserSocket({ userId: 'user-1' })).toMatchObject({ allowed: true });
  });

  it('thread subscribe 실패 budget은 반복 unauthorized/invalid churn을 제한한다', () => {
    const { limiter } = createLimiter();

    expect(limiter.consumeThreadSubscription({ socketId: 'socket-1', failed: true })).toMatchObject(
      {
        allowed: true,
      },
    );
    expect(limiter.consumeThreadSubscription({ socketId: 'socket-1', failed: true })).toMatchObject(
      {
        allowed: false,
        scope: 'chat:ws:subscribe:failure',
      },
    );
  });

  it('request ip는 기본적으로 forwarded header를 신뢰하지 않고 socket address로 fallback한다', () => {
    expect(
      resolveChatRealtimeRequestIp({
        headers: {
          'x-forwarded-for': '203.0.113.10, 10.0.0.1',
        },
        ip: '127.0.0.1',
      }),
    ).toBe('127.0.0.1');
    expect(
      resolveChatRealtimeRequestIp(
        {
          headers: {
            'x-forwarded-for': '203.0.113.10, 10.0.0.1',
          },
          ip: '127.0.0.1',
        },
        { trustProxy: true },
      ),
    ).toBe('203.0.113.10');
    expect(
      resolveChatRealtimeRequestIp({
        headers: {},
        socket: { remoteAddress: '127.0.0.2' },
      }),
    ).toBe('127.0.0.2');
  });

  it('trusted proxy 설정이 켜진 limiter instance만 forwarded header를 rate-limit key로 사용한다', () => {
    const { limiter: untrustedLimiter } = createLimiter({ trustProxy: false });
    const { limiter: trustedLimiter } = createLimiter({ trustProxy: true });
    const source = {
      headers: {
        'x-forwarded-for': '203.0.113.10, 10.0.0.1',
      },
      ip: '127.0.0.1',
    };

    expect(untrustedLimiter.resolveRequestIp(source)).toBe('127.0.0.1');
    expect(trustedLimiter.resolveRequestIp(source)).toBe('203.0.113.10');
  });
});

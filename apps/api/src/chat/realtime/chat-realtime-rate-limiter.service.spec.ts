import { readChatRealtimeProxyProfile } from './chat-realtime.config.js';
import { describe, expect, it } from 'vitest';
import {
  ChatRealtimeRateLimiterService,
  resolveChatRealtimeRequestIp,
} from './chat-realtime-rate-limiter.service.js';

function createSettings(overrides: Record<string, unknown> = {}) {
  return {
    allowedOrigins: false as const,
    proxyProfile: readChatRealtimeProxyProfile({}),
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
  const trusted = readChatRealtimeProxyProfile({
    CHAT_REALTIME_TRUST_PROXY: 'true',
    HTTP_TRUST_PROXY_CIDRS: '10.0.0.2',
  });
  it.each([
    [undefined, 'unknown'],
    [{}, 'unknown'],
    [{ peerAddress: ' 127.0.0.2 ' }, '127.0.0.2'],
    [{ peerAddress: '::ffff:127.0.0.2' }, '127.0.0.2'],
    [{ peerAddress: '10.0.0.99', headers: { 'x-forwarded-for': '203.0.113.1' } }, '10.0.0.99'],
    [{ peerAddress: '10.0.0.2', headers: { 'X-Forwarded-For': '203.0.113.1' } }, '203.0.113.1'],
    [{ peerAddress: '10.0.0.2', headers: { 'x-forwarded-for': ['203.0.113.1'] } }, '10.0.0.2'],
    [
      {
        peerAddress: '10.0.0.2',
        headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1', 'x-real-ip': '203.0.113.2' },
      },
      '10.0.0.2',
    ],
    [
      {
        peerAddress: '10.0.0.2',
        headers: { 'x-forwarded-for': '203.0.113.1', 'X-Forwarded-For': '203.0.113.2' },
      },
      '10.0.0.2',
    ],
    [{ peerAddress: null, headers: { 'x-forwarded-for': '203.0.113.1' } }, 'unknown'],
    [{ peerAddress: 'invalid', headers: { 'x-forwarded-for': '203.0.113.1' } }, 'unknown'],
  ] as const)('raw-peer-first extraction %j -> %s', (source, expected) => {
    expect(
      resolveChatRealtimeRequestIp(
        source as Parameters<typeof resolveChatRealtimeRequestIp>[0],
        trusted,
      ),
    ).toBe(expected);
  });
  it('ignores derived Express identity when chat forwarding is disabled', () => {
    const source = {
      ip: '203.0.113.10',
      peerAddress: '10.0.0.99',
      headers: { 'x-real-ip': '203.0.113.1' },
    };
    expect(resolveChatRealtimeRequestIp(source)).toBe('10.0.0.99');
  });
  it('same untrusted peer cannot rotate ticket buckets; trusted distinct clients remain separate', () => {
    const { limiter } = createLimiter({ proxyProfile: trusted, ticketIpLimit: 1 });
    const consume = (peerAddress: string, forwarded: string, userId: string) =>
      limiter.consumeRealtimeTicket({
        userId,
        ip: limiter.resolveRequestIp({ peerAddress, headers: { 'x-forwarded-for': forwarded } }),
      }).allowed;
    expect(consume('10.0.0.99', '203.0.113.1', 'u1')).toBe(true);
    expect(consume('10.0.0.99', '203.0.113.2', 'u2')).toBe(false);
    expect(consume('10.0.0.2', '203.0.113.1', 'u3')).toBe(true);
    expect(consume('10.0.0.2', '203.0.113.2', 'u4')).toBe(true);
  });

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
});

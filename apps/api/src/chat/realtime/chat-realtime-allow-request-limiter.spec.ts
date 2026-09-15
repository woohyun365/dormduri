import { createChatRealtimeSettings } from './chat-realtime.config.js';
import { describe, expect, it } from 'vitest';
import { createChatRealtimeAllowRequestIpRateLimiter } from './chat-realtime-allow-request-limiter.js';

function createRequest(ip = '203.0.113.10', remoteAddress = '10.0.0.10') {
  return {
    headers: {
      'x-forwarded-for': ip,
    },
    socket: { remoteAddress },
  } as never;
}

describe('createChatRealtimeAllowRequestIpRateLimiter', () => {
  it('allowRequest 단계에서 pre-auth IP connection budget을 제한하고 window reset 후 허용한다', () => {
    let nowMs = 1_000;
    const limiter = createChatRealtimeAllowRequestIpRateLimiter(
      createChatRealtimeSettings({
        CHAT_REALTIME_WS_CONNECT_IP_LIMIT: '2',
        CHAT_REALTIME_WS_CONNECT_IP_WINDOW_SECONDS: '60',
      }),
      () => nowMs,
    );

    expect(limiter(createRequest())).toBe(true);
    expect(limiter(createRequest())).toBe(true);
    expect(limiter(createRequest())).toBe(false);

    nowMs += 60_000;
    expect(limiter(createRequest())).toBe(true);
  });

  it('trusted proxy 설정이 없으면 spoofed x-forwarded-for 변경으로 pre-auth IP limit을 우회할 수 없다', () => {
    const limiter = createChatRealtimeAllowRequestIpRateLimiter(
      createChatRealtimeSettings({
        CHAT_REALTIME_WS_CONNECT_IP_LIMIT: '1',
        CHAT_REALTIME_WS_CONNECT_IP_WINDOW_SECONDS: '60',
      }),
    );

    expect(limiter(createRequest('203.0.113.10', '10.0.0.10'))).toBe(true);
    expect(limiter(createRequest('203.0.113.11', '10.0.0.10'))).toBe(false);
  });

  it('trusted proxy 설정이 켜진 환경에서만 x-forwarded-for를 pre-auth IP limit key로 사용한다', () => {
    const limiter = createChatRealtimeAllowRequestIpRateLimiter(
      createChatRealtimeSettings({
        CHAT_REALTIME_TRUST_PROXY: 'true',
        HTTP_TRUST_PROXY_CIDRS: '10.0.0.10',
        CHAT_REALTIME_WS_CONNECT_IP_LIMIT: '1',
        CHAT_REALTIME_WS_CONNECT_IP_WINDOW_SECONDS: '60',
      }),
    );

    expect(limiter(createRequest('203.0.113.10', '10.0.0.10'))).toBe(true);
    expect(limiter(createRequest('203.0.113.11', '10.0.0.10'))).toBe(true);
    expect(limiter(createRequest('203.0.113.10', '10.0.0.99'))).toBe(true);
    expect(limiter(createRequest('203.0.113.11', '10.0.0.99'))).toBe(false);
  });
});

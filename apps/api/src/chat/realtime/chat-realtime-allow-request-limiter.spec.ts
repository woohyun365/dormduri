import { createChatRealtimeAllowRequestIpRateLimiter } from './chat-realtime-allow-request-limiter.js';

function createRequest(ip = '203.0.113.10') {
  return {
    headers: {
      'x-forwarded-for': ip,
    },
    socket: {},
  } as never;
}

describe('createChatRealtimeAllowRequestIpRateLimiter', () => {
  it('allowRequest 단계에서 pre-auth IP connection budget을 제한하고 window reset 후 허용한다', () => {
    let nowMs = 1_000;
    const limiter = createChatRealtimeAllowRequestIpRateLimiter(
      {
        CHAT_REALTIME_WS_CONNECT_IP_LIMIT: '2',
        CHAT_REALTIME_WS_CONNECT_IP_WINDOW_SECONDS: '60',
      } as NodeJS.ProcessEnv,
      () => nowMs,
    );

    expect(limiter(createRequest())).toBe(true);
    expect(limiter(createRequest())).toBe(true);
    expect(limiter(createRequest())).toBe(false);

    nowMs += 60_000;
    expect(limiter(createRequest())).toBe(true);
  });
});

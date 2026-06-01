import {
  createChatRealtimeAllowRequest,
  isChatRealtimeRequestOriginAllowed,
} from './chat-realtime-origin-policy.js';

describe('chat realtime origin policy', () => {
  it('allowlist origin과 정확히 일치하는 browser request만 허용한다', () => {
    expect(
      isChatRealtimeRequestOriginAllowed({
        requestOrigin: 'https://knu-roommate.example.com',
        allowedOrigins: ['https://knu-roommate.example.com'],
        host: 'api.example.com',
      }),
    ).toBe(true);

    expect(
      isChatRealtimeRequestOriginAllowed({
        requestOrigin: 'https://evil.example.com',
        allowedOrigins: ['https://knu-roommate.example.com'],
        host: 'api.example.com',
      }),
    ).toBe(false);
  });

  it('Origin 없는 non-browser/CLI handshake는 ticket auth 이전에 거절한다', () => {
    expect(
      isChatRealtimeRequestOriginAllowed({
        requestOrigin: undefined,
        allowedOrigins: ['https://knu-roommate.example.com'],
        host: 'api.example.com',
      }),
    ).toBe(false);
  });

  it('allowlist가 없으면 same-origin reverse proxy 요청만 허용한다', () => {
    expect(
      isChatRealtimeRequestOriginAllowed({
        requestOrigin: 'https://knu-roommate.example.com',
        allowedOrigins: false,
        forwardedHost: 'knu-roommate.example.com',
        forwardedProto: 'https',
        host: 'internal-api:4000',
      }),
    ).toBe(true);

    expect(
      isChatRealtimeRequestOriginAllowed({
        requestOrigin: 'https://evil.example.com',
        allowedOrigins: false,
        forwardedHost: 'knu-roommate.example.com',
        forwardedProto: 'https',
        host: 'internal-api:4000',
      }),
    ).toBe(false);
  });

  it('origin 허용 후 allowRequest pre-auth rate limit 초과 시 callback false를 반환한다', () => {
    const preAuthRateLimit = jest.fn(() => false);
    const allowRequest = createChatRealtimeAllowRequest(['https://knu-roommate.example.com'], {
      preAuthRateLimit,
    });
    const callback = jest.fn();
    const request = {
      headers: {
        origin: 'https://knu-roommate.example.com',
        host: 'api.example.com',
      },
      socket: {},
    } as never;

    allowRequest(request, callback);

    expect(preAuthRateLimit).toHaveBeenCalledWith(request);
    expect(callback).toHaveBeenCalledWith(null, false);
  });

  it('Socket.IO allowRequest callback은 origin policy 결과를 반환한다', () => {
    const allowRequest = createChatRealtimeAllowRequest(['https://knu-roommate.example.com']);
    const callback = jest.fn();

    allowRequest(
      {
        headers: {
          origin: 'https://knu-roommate.example.com',
          host: 'api.example.com',
        },
        socket: {},
      } as never,
      callback,
    );

    expect(callback).toHaveBeenCalledWith(null, true);
  });
});

import { readChatRealtimeProxyProfile } from './chat-realtime.config.js';
const proxyProfile = readChatRealtimeProxyProfile({
  CHAT_REALTIME_TRUST_PROXY: 'true',
  HTTP_TRUST_PROXY_CIDRS: '10.0.0.2',
});
import { describe, expect, it, vi } from 'vitest';
import {
  createChatRealtimeAllowRequest,
  isChatRealtimeRequestOriginAllowed,
} from './chat-realtime-origin-policy.js';

describe('chat realtime origin policy', () => {
  it('does not admit an untrusted peer through forged forwarding metadata', () => {
    const callback = vi.fn();
    createChatRealtimeAllowRequest(false, { proxyProfile })(
      {
        headers: {
          origin: 'https://evil.example',
          host: 'api.example',
          'x-forwarded-host': 'evil.example',
          'x-forwarded-proto': 'https',
        },
        socket: { remoteAddress: '10.0.0.99' },
      } as never,
      callback,
    );
    expect(callback).toHaveBeenCalledWith(null, false);
  });
  it('allowlist origin과 정확히 일치하는 browser request만 허용한다', () => {
    expect(
      isChatRealtimeRequestOriginAllowed({
        requestOrigin: 'https://dormduri.example.com',
        allowedOrigins: ['https://dormduri.example.com'],
        host: 'api.example.com',
      }),
    ).toBe(true);

    expect(
      isChatRealtimeRequestOriginAllowed({
        requestOrigin: 'https://evil.example.com',
        allowedOrigins: ['https://dormduri.example.com'],
        host: 'api.example.com',
      }),
    ).toBe(false);
  });

  it('Origin 없는 non-browser/CLI handshake는 ticket auth 이전에 거절한다', () => {
    expect(
      isChatRealtimeRequestOriginAllowed({
        requestOrigin: undefined,
        allowedOrigins: ['https://dormduri.example.com'],
        host: 'api.example.com',
      }),
    ).toBe(false);
  });

  it('allowlist가 없으면 same-origin reverse proxy 요청만 허용한다', () => {
    expect(
      isChatRealtimeRequestOriginAllowed({
        requestOrigin: 'https://dormduri.example.com',
        allowedOrigins: false,
        forwardedHost: 'dormduri.example.com',
        forwardedProto: 'https',
        host: 'internal-api:4000',
        proxyProfile,
        peerAddress: '10.0.0.2',
      }),
    ).toBe(true);

    expect(
      isChatRealtimeRequestOriginAllowed({
        requestOrigin: 'https://evil.example.com',
        allowedOrigins: false,
        forwardedHost: 'dormduri.example.com',
        forwardedProto: 'https',
        host: 'internal-api:4000',
        proxyProfile,
        peerAddress: '10.0.0.2',
      }),
    ).toBe(false);
  });

  it('trust proxy가 꺼져 있으면 forwarded host spoofing으로 same-origin fallback을 통과할 수 없다', () => {
    expect(
      isChatRealtimeRequestOriginAllowed({
        requestOrigin: 'https://dormduri.example.com',
        allowedOrigins: false,
        forwardedHost: 'dormduri.example.com',
        forwardedProto: 'https',
        host: 'internal-api:4000',
        proxyProfile: readChatRealtimeProxyProfile({}),
        peerAddress: '10.0.0.2',
      }),
    ).toBe(false);
  });

  it('origin 허용 후 allowRequest pre-auth rate limit 초과 시 callback false를 반환한다', () => {
    const preAuthRateLimit = vi.fn(() => false);
    const allowRequest = createChatRealtimeAllowRequest(['https://dormduri.example.com'], {
      preAuthRateLimit,
    });
    const callback = vi.fn();
    const request = {
      headers: {
        origin: 'https://dormduri.example.com',
        host: 'api.example.com',
      },
      socket: {},
    } as never;

    allowRequest(request, callback);

    expect(preAuthRateLimit).toHaveBeenCalledWith(request);
    expect(callback).toHaveBeenCalledWith(null, false);
  });

  it('Socket.IO allowRequest callback은 origin policy 결과를 반환한다', () => {
    const allowRequest = createChatRealtimeAllowRequest(['https://dormduri.example.com']);
    const callback = vi.fn();

    allowRequest(
      {
        headers: {
          origin: 'https://dormduri.example.com',
          host: 'api.example.com',
        },
        socket: {},
      } as never,
      callback,
    );

    expect(callback).toHaveBeenCalledWith(null, true);
  });
});

describe('same-origin provenance pairs', () => {
  it.each([
    { forwardedHost: ['api.example'], forwardedProto: 'https' },
    { forwardedHost: 'api.example, evil.example', forwardedProto: 'https' },
    { forwardedHost: 'api.example', forwardedProto: undefined },
    { forwardedHost: undefined, forwardedProto: 'https' },
    { forwardedHost: 'api.example', forwardedProto: 'https,http' },
    { forwardedHost: 'api.example/path', forwardedProto: 'https' },
    { forwardedHost: 'evil@api.example', forwardedProto: 'https' },
  ])('rejects partial/malformed pair %j without mixing provenance', (headers) => {
    expect(
      isChatRealtimeRequestOriginAllowed({
        ...headers,
        requestOrigin: 'https://api.example',
        host: 'api.example',
        encrypted: false,
        allowedOrigins: false,
        proxyProfile,
        peerAddress: '10.0.0.2',
      }),
    ).toBe(false);
    expect(
      isChatRealtimeRequestOriginAllowed({
        ...headers,
        requestOrigin: 'http://api.example',
        host: 'api.example',
        encrypted: false,
        allowedOrigins: false,
        proxyProfile,
        peerAddress: '10.0.0.2',
      }),
    ).toBe(true);
  });
  it('rejects duplicate forwarding spellings before spending the pre-auth budget', () => {
    const preAuthRateLimit = vi.fn(() => true);
    const callback = vi.fn();
    createChatRealtimeAllowRequest(false, { proxyProfile, preAuthRateLimit })(
      {
        headers: {
          host: 'internal',
          origin: 'https://api.example',
          'x-forwarded-host': 'api.example',
          'X-Forwarded-Host': 'api.example',
          'x-forwarded-proto': 'https',
        },
        socket: { remoteAddress: '10.0.0.2' },
      } as never,
      callback,
    );
    expect(callback).toHaveBeenCalledWith(null, false);
    expect(preAuthRateLimit).not.toHaveBeenCalled();
  });
  it.each([
    'null',
    'file:///etc/passwd',
    'https://api.example/path',
    'https://api.example#x',
    'https://a@api.example',
  ])('rejects invalid Origin %s', (requestOrigin) => {
    expect(
      isChatRealtimeRequestOriginAllowed({
        requestOrigin,
        allowedOrigins: false,
        host: 'api.example',
        encrypted: true,
      }),
    ).toBe(false);
  });
});

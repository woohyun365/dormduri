import { describe, expect, it } from 'vitest';
import { buildJsonResponse, setAuthCookie, setAuthTransportCookies } from '../_shared';

const ACCESS_TOKEN = `v1.session-access.${'c'.repeat(43)}`;
const RENEWAL_TOKEN = `v1.session-renewal.${'d'.repeat(43)}`;

describe('auth BFF shared helpers', () => {
  it('upstream status를 보존한다', async () => {
    const upstream = new Response(JSON.stringify({ success: false }), { status: 429 });
    const response = buildJsonResponse(upstream, { success: false });

    expect(response.status).toBe(429);
  });

  it('rememberMe 미체크 시 session cookie를 설정한다', () => {
    const response = buildJsonResponse(new Response('{}', { status: 200 }), { success: true });
    setAuthCookie(response, ACCESS_TOKEN, false);

    const cookie = response.cookies.get('auth-token');
    expect(cookie?.value).toBe(ACCESS_TOKEN);
    expect(cookie?.maxAge).toBeUndefined();
  });

  it('rememberMe 체크 시 persistent cookie를 설정한다', () => {
    const response = buildJsonResponse(new Response('{}', { status: 200 }), { success: true });
    setAuthCookie(response, ACCESS_TOKEN, true);

    const cookie = response.cookies.get('auth-token');
    expect(cookie?.value).toBe(ACCESS_TOKEN);
    expect(cookie?.maxAge).toBe(60 * 60 * 24 * 7);
  });

  it('Phase 0 expected-change: rememberMe 체크 시 7일 session/token family TTL에 맞춘 persistent cookie를 설정한다', () => {
    const response = buildJsonResponse(new Response('{}', { status: 200 }), { success: true });
    setAuthCookie(response, ACCESS_TOKEN, true);

    const cookie = response.cookies.get('auth-token');
    expect(cookie?.value).toBe(ACCESS_TOKEN);
    expect(cookie?.maxAge).toBe(60 * 60 * 24 * 7);
  });

  it('rememberMe transport는 renewal cookie를 access cookie와 분리해 저장한다', () => {
    const response = buildJsonResponse(new Response('{}', { status: 200 }), { success: true });
    setAuthTransportCookies(response, {
      accessToken: ACCESS_TOKEN,
      renewalToken: RENEWAL_TOKEN,
      rememberMe: true,
    });

    expect(response.cookies.get('auth-token')?.value).toBe(ACCESS_TOKEN);
    expect(response.cookies.get('auth-token')?.maxAge).toBe(60 * 60 * 24 * 7);
    expect(response.cookies.get('auth-renewal-token')?.value).toBe(RENEWAL_TOKEN);
    expect(response.cookies.get('auth-renewal-token')?.maxAge).toBe(60 * 60 * 24 * 7);
  });
});

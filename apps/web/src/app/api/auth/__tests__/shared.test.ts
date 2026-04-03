import { describe, expect, it } from 'vitest';
import { buildJsonResponse, setAuthCookie } from '../_shared';

describe('auth BFF shared helpers', () => {
  it('upstream status를 보존한다', async () => {
    const upstream = new Response(JSON.stringify({ success: false }), { status: 429 });
    const response = buildJsonResponse(upstream, { success: false });

    expect(response.status).toBe(429);
  });

  it('rememberMe 미체크 시 session cookie를 설정한다', () => {
    const response = buildJsonResponse(new Response('{}', { status: 200 }), { success: true });
    setAuthCookie(response, 'token', false);

    const cookie = response.cookies.get('auth-token');
    expect(cookie?.value).toBe('token');
    expect(cookie?.maxAge).toBeUndefined();
  });

  it('rememberMe 체크 시 persistent cookie를 설정한다', () => {
    const response = buildJsonResponse(new Response('{}', { status: 200 }), { success: true });
    setAuthCookie(response, 'token', true);

    const cookie = response.cookies.get('auth-token');
    expect(cookie?.value).toBe('token');
    expect(cookie?.maxAge).toBe(60 * 15);
  });
});

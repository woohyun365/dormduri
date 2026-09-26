import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readServerSessionFromRequest } from './read-session';

const readUpstream = vi.hoisted(() => vi.fn());
vi.mock('@/app/api/_bff/server-read', () => ({ readConfiguredUpstreamJson: readUpstream }));

function cookies(values: Record<string, string>) {
  return { get: (name: string) => (values[name] ? { value: values[name] } : undefined) };
}
const requestHeaders = new Headers({ 'user-agent': 'test' });

describe('read-only server session facade', () => {
  beforeEach(() => readUpstream.mockReset());

  it('redirect classification requires truly absent cookie material', async () => {
    await expect(
      readServerSessionFromRequest({ cookieStore: cookies({}), requestHeaders }),
    ).resolves.toEqual({ status: 'unauthenticated' });
    await expect(
      readServerSessionFromRequest({
        cookieStore: cookies({ 'auth-renewal-token': 'renew-secret' }),
        requestHeaders,
      }),
    ).resolves.toEqual({ status: 'recovery-required' });
    expect(readUpstream).not.toHaveBeenCalled();
  });

  it.each([
    'MISSING_TOKEN',
    'MALFORMED_TOKEN',
    'ACCESS_EXPIRED',
    'SESSION_NOT_FOUND',
    'SESSION_REVOKED',
    'SESSION_EXPIRED',
    'ACCOUNT_DELETED',
    'ACCOUNT_IDENTITY_INCOMPLETE',
  ])('keeps rejected cookie material in token-free browser recovery for %s', async (reason) => {
    readUpstream.mockResolvedValue({ ok: true, data: { authenticated: false, reason } });
    await expect(
      readServerSessionFromRequest({
        cookieStore: cookies({ 'auth-token': 'access-secret' }),
        requestHeaders,
      }),
    ).resolves.toEqual({ status: 'recovery-required' });
    expect(readUpstream).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/auth/session', authorization: 'Bearer access-secret' }),
    );
    expect(readUpstream.mock.calls.flatMap(([input]) => [input.path])).not.toContain(
      '/auth/renew-session',
    );
  });

  it('returns only safe identity for a valid session and unavailable for transport/schema failures', async () => {
    const user = {
      id: 'viewer-a',
      email: 'a@kangwon.ac.kr',
      nickname: 'A',
      gender: 'M',
      campus: 'CHUNCHEON',
    };
    readUpstream.mockResolvedValueOnce({ ok: true, data: { authenticated: true, user } });
    const resolution = await readServerSessionFromRequest({
      cookieStore: cookies({ 'auth-token': 'raw-token' }),
      requestHeaders,
    });
    expect(resolution).toEqual({ status: 'authenticated', user });
    expect(JSON.stringify(resolution)).not.toContain('raw-token');

    readUpstream.mockResolvedValue({ ok: false, kind: 'invalid-response' });
    await expect(
      readServerSessionFromRequest({
        cookieStore: cookies({ 'auth-token': 'raw-token' }),
        requestHeaders,
      }),
    ).resolves.toEqual({ status: 'unavailable' });
  });
});

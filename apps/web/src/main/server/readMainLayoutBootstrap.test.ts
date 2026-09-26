import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHomeDashboardTestResponse } from '@/main/test-support/home-dashboard.builder';
import {
  readMainLayoutBootstrap,
  readMainLayoutBootstrapFromRequest,
} from './readMainLayoutBootstrap';

const readSession = vi.hoisted(() => vi.fn());
const readUpstream = vi.hoisted(() => vi.fn());
const nextRuntime = vi.hoisted(() => ({
  cookies: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock('@/auth/server', () => ({ readServerSessionFromRequest: readSession }));
vi.mock('@/app/api/_bff/server-read', () => ({ readConfiguredUpstreamJson: readUpstream }));
vi.mock('next/headers', () => ({ cookies: nextRuntime.cookies, headers: nextRuntime.headers }));
vi.mock('next/navigation', () => ({ redirect: nextRuntime.redirect }));

const requestHeaders = new Headers({ 'x-forwarded-for': '127.0.0.1' });
const cookieStore = {
  get: (name: string) => (name.includes('auth-token') ? { value: 'secret' } : undefined),
};

describe('Main server bootstrap', () => {
  beforeEach(() => {
    readSession.mockReset();
    readUpstream.mockReset();
    nextRuntime.cookies.mockReset();
    nextRuntime.headers.mockReset();
    nextRuntime.redirect.mockReset();
  });

  it('redirects before rendering private content when no auth material exists', async () => {
    nextRuntime.cookies.mockResolvedValue(cookieStore);
    nextRuntime.headers.mockResolvedValue(requestHeaders);
    readSession.mockResolvedValue({ status: 'unauthenticated' });
    nextRuntime.redirect.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT:/login');
    });
    await expect(readMainLayoutBootstrap()).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(nextRuntime.redirect).toHaveBeenCalledWith('/login');
    expect(readUpstream).not.toHaveBeenCalled();
  });

  it('serializes only viewer identity and matching validated dashboard', async () => {
    const dashboard = createHomeDashboardTestResponse();
    readSession.mockResolvedValue({
      status: 'authenticated',
      user: dashboard.viewer.identity.user,
    });
    readUpstream.mockResolvedValue({ ok: true, data: dashboard });
    const result = await readMainLayoutBootstrapFromRequest({ cookieStore, requestHeaders });
    expect(result).toEqual({
      status: 'ready',
      viewerId: dashboard.viewer.identity.user.id,
      dashboard,
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('Authorization');
    expect(readUpstream).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/home/dashboard',
        allowedPathPrefix: '/api',
        authorization: 'Bearer secret',
      }),
    );
  });

  it.each([
    [{ status: 'unauthenticated' }, { status: 'unauthenticated' }],
    [{ status: 'recovery-required' }, { status: 'session-recovery-required' }],
    [{ status: 'unavailable' }, { status: 'session-unavailable' }],
  ])('does not read private dashboard for session state %o', async (session, expected) => {
    readSession.mockResolvedValue(session);
    await expect(
      readMainLayoutBootstrapFromRequest({ cookieStore, requestHeaders }),
    ).resolves.toEqual(expected);
    expect(readUpstream).not.toHaveBeenCalled();
  });

  it('never serializes a cross-user dashboard and sends auth failures to recovery', async () => {
    const dashboard = createHomeDashboardTestResponse();
    readSession.mockResolvedValue({
      status: 'authenticated',
      user: { ...dashboard.viewer.identity.user, id: 'viewer-a' },
    });
    readUpstream.mockResolvedValueOnce({ ok: true, data: dashboard });
    await expect(
      readMainLayoutBootstrapFromRequest({ cookieStore, requestHeaders }),
    ).resolves.toEqual({ status: 'session-recovery-required' });
    readUpstream.mockResolvedValue({ ok: false, kind: 'upstream', status: 401 });
    await expect(
      readMainLayoutBootstrapFromRequest({ cookieStore, requestHeaders }),
    ).resolves.toEqual({ status: 'session-recovery-required' });
  });

  it('does not share dashboard data across sequential users in one worker', async () => {
    const first = createHomeDashboardTestResponse();
    const second = structuredClone(first);
    second.viewer.identity.user.id = 'viewer-b';
    readSession
      .mockResolvedValueOnce({ status: 'authenticated', user: first.viewer.identity.user })
      .mockResolvedValueOnce({ status: 'authenticated', user: second.viewer.identity.user });
    readUpstream
      .mockResolvedValueOnce({ ok: true, data: first })
      .mockResolvedValueOnce({ ok: true, data: second });
    const a = await readMainLayoutBootstrapFromRequest({ cookieStore, requestHeaders });
    const b = await readMainLayoutBootstrapFromRequest({ cookieStore, requestHeaders });
    expect([a.status === 'ready' && a.viewerId, b.status === 'ready' && b.viewerId]).toEqual([
      first.viewer.identity.user.id,
      'viewer-b',
    ]);
  });
});

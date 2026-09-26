import 'server-only';

import { cookies, headers } from 'next/headers';
import { homeDashboardResponseSchema, type HomeDashboardResponse } from '@repo/shared/home';
import { redirect } from 'next/navigation';
import { resolveAuthCookieNames } from '@/config/auth-cookie.config';
import { readConfiguredUpstreamJson } from '@/app/api/_bff/server-read';
import { readServerSessionFromRequest } from '@/auth/server';

export type MainLayoutBootstrap =
  | { status: 'ready'; viewerId: string; dashboard: HomeDashboardResponse }
  | { status: 'dashboard-unavailable'; viewerId: string }
  | { status: 'session-recovery-required' }
  | { status: 'session-unavailable' };

type CookieReader = { get(name: string): { value: string } | undefined };

export async function readMainLayoutBootstrapFromRequest(input: {
  cookieStore: CookieReader;
  requestHeaders: Pick<Headers, 'get'>;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<MainLayoutBootstrap | { status: 'unauthenticated' }> {
  const session = await readServerSessionFromRequest(input);
  if (session.status === 'unauthenticated') return session;
  if (session.status === 'recovery-required') return { status: 'session-recovery-required' };
  if (session.status === 'unavailable') return { status: 'session-unavailable' };

  const accessToken = input.cookieStore.get(resolveAuthCookieNames().access)?.value;
  if (!accessToken) return { status: 'session-recovery-required' };
  const result = await readConfiguredUpstreamJson({
    path: '/api/home/dashboard',
    allowedPathPrefix: '/api',
    operation: 'home.dashboard.server_read',
    requestHeaders: input.requestHeaders,
    authorization: `Bearer ${accessToken}`,
    responseSchema: homeDashboardResponseSchema,
    signal: input.signal,
    timeoutMs: input.timeoutMs,
  });
  if (!result.ok) {
    if (result.kind === 'upstream' && (result.status === 401 || result.status === 403)) {
      return { status: 'session-recovery-required' };
    }
    return { status: 'dashboard-unavailable', viewerId: session.user.id };
  }
  if (result.data.viewer.identity.user.id !== session.user.id) {
    return { status: 'session-recovery-required' };
  }
  return { status: 'ready', viewerId: session.user.id, dashboard: result.data };
}

export async function readMainLayoutBootstrap(): Promise<MainLayoutBootstrap> {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const bootstrap = await readMainLayoutBootstrapFromRequest({ cookieStore, requestHeaders });
  if (bootstrap.status === 'unauthenticated') redirect('/login');
  return bootstrap;
}

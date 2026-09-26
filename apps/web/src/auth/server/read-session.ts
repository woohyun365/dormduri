import 'server-only';

import { cookies, headers } from 'next/headers';
import { apiSessionResponseSchema } from '@repo/shared/auth/session';
import type { AuthenticatedSessionUser } from '@repo/shared/auth/response';
import { resolveAuthCookieNames } from '@/config/auth-cookie.config';
import { readConfiguredUpstreamJson } from '@/app/api/_bff/server-read';

export type ServerSessionResolution =
  | { status: 'authenticated'; user: AuthenticatedSessionUser }
  | { status: 'unauthenticated' }
  | { status: 'recovery-required' }
  | { status: 'unavailable' };

type CookieReader = { get(name: string): { value: string } | undefined };

export async function readServerSessionFromRequest(input: {
  cookieStore: CookieReader;
  requestHeaders: Pick<Headers, 'get'>;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<ServerSessionResolution> {
  const names = resolveAuthCookieNames();
  const accessToken = input.cookieStore.get(names.access)?.value;
  const hasRenewal = Boolean(input.cookieStore.get(names.renewal)?.value);
  if (!accessToken) {
    return hasRenewal ? { status: 'recovery-required' } : { status: 'unauthenticated' };
  }

  const result = await readConfiguredUpstreamJson({
    path: '/auth/session',
    allowedPathPrefix: '/auth',
    operation: 'auth.session.server_read',
    requestHeaders: input.requestHeaders,
    authorization: `Bearer ${accessToken}`,
    responseSchema: apiSessionResponseSchema,
    signal: input.signal,
    timeoutMs: input.timeoutMs,
  });
  if (!result.ok) return { status: 'unavailable' };
  if (result.data.authenticated) {
    return { status: 'authenticated', user: result.data.user };
  }
  // Any rejected cookie material goes through the response-capable browser BFF.
  // That owner alone may renew or clear cookies; RSC rendering remains read-only.
  return { status: 'recovery-required' };
}

export async function readServerSession(): Promise<ServerSessionResolution> {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  return readServerSessionFromRequest({ cookieStore, requestHeaders });
}

import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { sessionInfoResponseSchema, type SessionInfoResponse } from '@repo/shared/backoffice';
import { callBackofficeApi } from '@/bff/upstream';
import { SESSION_COOKIE_NAME } from '@/bff/session-cookie';

/**
 * Server render read of the operator's session (README §3). Every page calls it; React `cache` keeps
 * it to one `GET /auth/session` per request. That call moves the session's last activity, so the
 * screen never polls it: the idle notice counts down from the time this read returned.
 */
export interface ActiveSession {
  readonly session: SessionInfoResponse;
  /** Milliseconds until the idle limit, measured on the server next to the API. */
  readonly idleRemainingMs: number;
  /** Milliseconds until the absolute limit; activity does not move it. */
  readonly absoluteRemainingMs: number;
}

export type SessionState =
  | { readonly kind: 'none' }
  | { readonly kind: 'ended' }
  | ({ readonly kind: 'active' } & ActiveSession);

export class BackofficeUnavailableError extends Error {
  constructor() {
    super('backoffice API unavailable');
    this.name = 'BackofficeUnavailableError';
  }
}

export async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value || undefined;
}

export const readSession = cache(async (): Promise<SessionState> => {
  const token = await sessionToken();
  if (!token) {
    return { kind: 'none' };
  }
  const result = await callBackofficeApi({
    method: 'GET',
    path: '/auth/session',
    token,
    responseSchema: sessionInfoResponseSchema,
  });
  if (result.kind === 'ok') {
    const now = Date.now();
    return {
      kind: 'active',
      session: result.data,
      idleRemainingMs: Math.max(0, Date.parse(result.data.idleExpiresAt) - now),
      absoluteRemainingMs: Math.max(0, Date.parse(result.data.absoluteExpiresAt) - now),
    };
  }
  if (result.kind === 'error' && result.code === 'session_expired') {
    return { kind: 'ended' };
  }
  if (result.kind === 'error' && result.code === 'session_required') {
    return { kind: 'none' };
  }
  throw new BackofficeUnavailableError();
});

/** Console pages: a full session, otherwise the login (with the ended notice) or the recovery page. */
export async function requireFullSession(): Promise<ActiveSession> {
  const state = await readSession();
  if (state.kind === 'none') {
    redirect('/login');
  }
  if (state.kind === 'ended') {
    redirect('/login?ended=expired');
  }
  if (state.session.scope === 'RECOVERY') {
    redirect('/recovery');
  }
  return state;
}

/** The recovery page: only a recovery-scope session (it may add a passkey and log out). */
export async function requireRecoverySession(): Promise<ActiveSession> {
  const state = await readSession();
  if (state.kind === 'none') {
    redirect('/login');
  }
  if (state.kind === 'ended') {
    redirect('/login?ended=expired');
  }
  if (state.session.scope === 'FULL') {
    redirect('/');
  }
  return state;
}

export function hasPermission(
  session: SessionInfoResponse,
  permission: SessionInfoResponse['permissions'][number],
): boolean {
  return session.permissions.includes(permission);
}

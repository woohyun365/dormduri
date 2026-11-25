import 'server-only';
import { notFound, redirect } from 'next/navigation';
import type { z } from 'zod';
import { callBackofficeApi } from '@/bff/upstream';
import { BackofficeUnavailableError, sessionToken } from './session';

export type PageRead<T> =
  { readonly kind: 'ok'; readonly data: T } | { readonly kind: 'forbidden' };

/**
 * A server component read of the backoffice API for one page (README §1: per request, no cache). An
 * ended session goes to the login (with the closed notice when the cookie's session is gone, README §4),
 * a missing permission renders the page's refusal, a missing target (a detail read of an id the API does
 * not have) renders the not-found page, and anything else the screen cannot use goes to the error
 * boundary.
 */
export async function readBackoffice<T>(
  path: string,
  schema: z.ZodType<T>,
  query?: URLSearchParams,
): Promise<PageRead<T>> {
  const token = await sessionToken();
  if (!token) {
    redirect('/login');
  }
  const result = await callBackofficeApi({
    method: 'GET',
    path,
    token,
    query,
    responseSchema: schema,
  });
  if (result.kind === 'ok') {
    return { kind: 'ok', data: result.data };
  }
  if (result.kind === 'error') {
    if (result.code === 'session_expired') redirect('/login?ended=expired');
    if (result.code === 'session_required') redirect('/login?ended=closed');
    if (result.code === 'recovery_scope') redirect('/recovery');
    if (result.code === 'permission_denied') return { kind: 'forbidden' };
    if (result.code === 'not_found') notFound();
  }
  throw new BackofficeUnavailableError();
}

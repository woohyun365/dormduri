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
 * a missing permission renders the page's refusal, and anything else the screen cannot use goes to the
 * error boundary (or to the caller's own line, as the home's pending reads do).
 */
export function readBackoffice<T>(
  path: string,
  schema: z.ZodType<T>,
  query?: URLSearchParams,
): Promise<PageRead<T>> {
  return read(path, schema, query, false);
}

/**
 * A detail read of one id a page put in the path: the same as `readBackoffice`, and a target the API does not have
 * renders the not-found page (README §4). A list read never takes this, so a missing route stays an unusable read.
 */
export function readBackofficeTarget<T>(path: string, schema: z.ZodType<T>): Promise<PageRead<T>> {
  return read(path, schema, undefined, true);
}

async function read<T>(
  path: string,
  schema: z.ZodType<T>,
  query: URLSearchParams | undefined,
  missingIsNotFound: boolean,
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
    if (missingIsNotFound && result.code === 'not_found') notFound();
  }
  throw new BackofficeUnavailableError();
}

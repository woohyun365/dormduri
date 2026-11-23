import type { BffErrorCode } from '@/bff/bff-errors';
import { SESSION_ACTIVITY_HEADER } from '@/bff/session-activity';

/**
 * Browser calls to this app's BFF (`/api/**`, README §3). The browser never calls the backoffice API.
 * `fetch` adds Origin and `Sec-Fetch-Site: same-origin`, which the BFF requires.
 */
export type BffResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly status: number; readonly code: BffErrorCode | 'network_error' };

/**
 * Fired after a BFF call reached the API with the session (the BFF says so with
 * SESSION_ACTIVITY_HEADER), so the idle countdown starts over.
 */
export const SESSION_ACTIVITY_EVENT = 'backoffice:session-activity';

export async function postBff<T = undefined>(
  path: `/api/${string}`,
  body?: unknown,
): Promise<BffResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    return { ok: false, status: 0, code: 'network_error' };
  }
  if (response.headers.get(SESSION_ACTIVITY_HEADER) === '1') {
    window.dispatchEvent(new Event(SESSION_ACTIVITY_EVENT));
  }
  if (response.ok) {
    const data = response.status === 204 ? undefined : ((await response.json()) as T);
    return { ok: true, data: data as T };
  }
  let code: BffErrorCode | 'network_error' = 'internal_error';
  try {
    const parsed = (await response.json()) as { error?: { code?: BffErrorCode } };
    code = parsed.error?.code ?? code;
  } catch {
    // keep the generic code
  }
  return { ok: false, status: response.status, code };
}

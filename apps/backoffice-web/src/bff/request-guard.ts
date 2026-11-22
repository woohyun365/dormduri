/**
 * Fixed origin of the backoffice (D-BF2): the operator opens `http://localhost:4300` through an SSM
 * port forward. The backoffice API checks the same origin for WebAuthn, so both are code constants.
 */
export const BACKOFFICE_ORIGIN = 'http://localhost:4300';
export const BACKOFFICE_HOST = 'localhost:4300';

export type MutationGuardResult =
  { readonly ok: true } | { readonly ok: false; readonly reason: 'origin' | 'fetch-site' | 'host' };

/**
 * Every state-changing BFF route accepts a request only when it is a same-origin request to the
 * fixed origin (D-BF4, README §3). `SameSite=Strict` does not separate `localhost:3000` from
 * `localhost:4300` (same site), so the BFF compares the exact Origin, requires the browser's Fetch
 * Metadata to say `same-origin`, and checks Host against DNS rebinding. A missing header fails.
 */
export function checkMutationRequest(headers: Headers): MutationGuardResult {
  if (headers.get('origin') !== BACKOFFICE_ORIGIN) {
    return { ok: false, reason: 'origin' };
  }
  if (headers.get('sec-fetch-site') !== 'same-origin') {
    return { ok: false, reason: 'fetch-site' };
  }
  if (headers.get('host') !== BACKOFFICE_HOST) {
    return { ok: false, reason: 'host' };
  }
  return { ok: true };
}

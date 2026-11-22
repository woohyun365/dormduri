/**
 * Content Security Policy of every page (D-BF4, README §5). The proxy makes a fresh nonce per request
 * and puts this policy on the request (Next.js reads the nonce from it and adds it to its own
 * scripts) and on the response. `'strict-dynamic'` lets those scripts load the page chunks.
 * Development adds `'unsafe-eval'` only because React's dev build needs it.
 */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function buildContentSecurityPolicy(
  nonce: string,
  { development }: { readonly development: boolean },
): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ''}`,
    "connect-src 'self'",
    "img-src 'self' data:",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'none'",
    "object-src 'none'",
  ].join('; ');
}

/** Headers every response carries, pages and static files alike (next.config.ts). */
export const STATIC_SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
] as const;

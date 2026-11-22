import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy, createNonce } from './content-security-policy';

function directives(policy: string): Map<string, string> {
  return new Map(
    policy.split(';').map((part) => {
      const [name, ...values] = part.trim().split(/\s+/u);
      return [name!, values.join(' ')];
    }),
  );
}

describe('content security policy (D-BF4)', () => {
  it('holds exactly the directives of the plan with the request nonce', () => {
    const policy = directives(buildContentSecurityPolicy('bm9uY2U=', { development: false }));
    expect(Object.fromEntries(policy)).toEqual({
      'default-src': "'self'",
      'script-src': "'self' 'nonce-bm9uY2U=' 'strict-dynamic'",
      'connect-src': "'self'",
      'img-src': "'self' data:",
      'frame-ancestors': "'none'",
      'form-action': "'self'",
      'base-uri': "'none'",
      'object-src': "'none'",
    });
  });

  it("adds 'unsafe-eval' only in development", () => {
    expect(
      directives(buildContentSecurityPolicy('n', { development: true })).get('script-src'),
    ).toBe("'self' 'nonce-n' 'strict-dynamic' 'unsafe-eval'");
  });

  it('makes a different 128-bit nonce each time', () => {
    const nonces = new Set(Array.from({ length: 50 }, () => createNonce()));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) {
      expect(atob(nonce)).toHaveLength(16);
    }
  });
});

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOGIN_REDIRECT_TARGET,
  normalizeLoginRedirectTarget,
} from '../login-redirect-target';

describe('normalizeLoginRedirectTarget', () => {
  it('/main만 허용한다', () => {
    expect(normalizeLoginRedirectTarget('/main')).toBe('/main');
  });

  it('absolute/protocol-relative/API/auth/empty target은 기본값으로 되돌린다', () => {
    expect(normalizeLoginRedirectTarget('https://evil.example/main')).toBe(
      DEFAULT_LOGIN_REDIRECT_TARGET,
    );
    expect(normalizeLoginRedirectTarget('//evil.example/main')).toBe(DEFAULT_LOGIN_REDIRECT_TARGET);
    expect(normalizeLoginRedirectTarget('/api/auth/session')).toBe(DEFAULT_LOGIN_REDIRECT_TARGET);
    expect(normalizeLoginRedirectTarget('/auth/callback')).toBe(DEFAULT_LOGIN_REDIRECT_TARGET);
    expect(normalizeLoginRedirectTarget('')).toBe(DEFAULT_LOGIN_REDIRECT_TARGET);
    expect(normalizeLoginRedirectTarget(null)).toBe(DEFAULT_LOGIN_REDIRECT_TARGET);
  });
});

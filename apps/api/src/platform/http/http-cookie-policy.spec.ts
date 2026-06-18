import { describe, expect, it } from 'vitest';
import { buildHttpCookieOptions } from './http-cookie-policy.js';

describe('buildHttpCookieOptions', () => {
  it('builds a secure httpOnly cookie policy for production surfaces', () => {
    expect(
      buildHttpCookieOptions({ secure: true, sameSite: 'lax', domain: '.example.com' }),
    ).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      domain: '.example.com',
      path: '/',
    });
  });

  it('omits domain when the deployment does not define a cookie domain', () => {
    expect(buildHttpCookieOptions({ secure: false, sameSite: 'lax', domain: null })).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
    });
  });

  it('rejects SameSite=None without secure cookies', () => {
    expect(() =>
      buildHttpCookieOptions({ secure: false, sameSite: 'none', domain: '.example.com' }),
    ).toThrow('SameSite=None cookies require secure=true');
  });
});

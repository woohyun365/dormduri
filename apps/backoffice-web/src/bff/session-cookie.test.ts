import { NextResponse } from 'next/server';
import { describe, expect, it } from 'vitest';
import { clearSessionCookie, SESSION_COOKIE_NAME, setSessionCookie } from './session-cookie';

function setCookieHeader(response: NextResponse): string {
  const values = response.headers.getSetCookie();
  expect(values).toHaveLength(1);
  return values[0]!;
}

function attributes(header: string): Map<string, string> {
  const [, ...parts] = header.split(';');
  return new Map(
    parts.map((part) => {
      const [name, ...value] = part.trim().split('=');
      return [name!.toLowerCase(), value.join('=')];
    }),
  );
}

describe('session cookie (D-BF4)', () => {
  it('is dormduri_bo_session, HttpOnly, Secure, SameSite=Strict, Path=/ with no Domain or expiry', () => {
    const response = NextResponse.json({});
    setSessionCookie(response, 'opaque-token');
    const header = setCookieHeader(response);
    expect(header.startsWith(`${SESSION_COOKIE_NAME}=opaque-token;`)).toBe(true);
    const attrs = attributes(header);
    expect(attrs.has('httponly')).toBe(true);
    expect(attrs.has('secure')).toBe(true);
    expect(attrs.get('samesite')?.toLowerCase()).toBe('strict');
    expect(attrs.get('path')).toBe('/');
    expect(attrs.has('domain')).toBe(false);
    expect(attrs.has('expires')).toBe(false);
    expect(attrs.has('max-age')).toBe(false);
  });

  it('clears with the same attributes and an immediate expiry', () => {
    const response = NextResponse.json({});
    clearSessionCookie(response);
    const header = setCookieHeader(response);
    expect(header.startsWith(`${SESSION_COOKIE_NAME}=;`)).toBe(true);
    const attrs = attributes(header);
    expect(attrs.has('httponly')).toBe(true);
    expect(attrs.has('secure')).toBe(true);
    expect(attrs.get('samesite')?.toLowerCase()).toBe('strict');
    expect(attrs.get('path')).toBe('/');
    expect(attrs.get('max-age')).toBe('0');
  });
});

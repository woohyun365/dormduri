import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, proxy } from './proxy';

describe('proxy route/session boundary', () => {
  it('auth route는 client session resolve가 authoritative redirect를 결정하도록 통과시킨다', async () => {
    const response = await proxy(
      new NextRequest('http://localhost/login', {
        headers: { Cookie: 'auth-token=opaque-session' },
      }),
    );

    expect(response.headers.get('location')).toBeNull();
  });

  it.each(['/main', '/notifications', '/support'])(
    'auth transport가 없는 사용자가 %s에 접근하면 /login으로 이동한다',
    async (pathname) => {
      const response = await proxy(new NextRequest(`http://localhost${pathname}`));

      expect(response.headers.get('location')).toBe('http://localhost/login');
    },
  );

  it('auth cookie가 있으면 dependency 확인 없이 protected route를 client shell까지 통과시킨다', async () => {
    const response = await proxy(
      new NextRequest('http://localhost/main', {
        headers: { Cookie: '__Host-auth-renewal-token=opaque-renewal' },
      }),
    );

    expect(response.headers.get('location')).toBeNull();
  });

  it('public root route는 proxy matcher 책임이 아니다', () => {
    expect(config.matcher).not.toContain('/');
    expect(config.matcher).toContain('/main/:path*');
    expect(config.matcher).toContain('/notifications/:path*');
    expect(config.matcher).toContain('/support/:path*');
    expect(config.matcher).not.toContain('/notices/:path*');
  });
});

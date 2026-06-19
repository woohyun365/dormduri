import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { config, proxy } from './proxy';

const createSessionResponse = (authenticated: boolean) =>
  new Response(JSON.stringify({ authenticated }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('proxy route/session boundary', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.fails('인증 사용자가 auth route에 접근하면 /main으로 이동한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => createSessionResponse(true)),
    );

    const response = await proxy(new NextRequest('http://localhost/login'));

    expect(response.headers.get('location')).toBe('http://localhost/main');
  });

  it('비인증 사용자가 /main에 접근하면 /login으로 이동한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => createSessionResponse(false)),
    );

    const response = await proxy(new NextRequest('http://localhost/main'));

    expect(response.headers.get('location')).toBe('http://localhost/login');
  });

  it('public root route는 proxy matcher 책임이 아니다', () => {
    expect(config.matcher).not.toContain('/');
    expect(config.matcher).toContain('/main/:path*');
  });
});

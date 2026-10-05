import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readConfiguredUpstreamJson } from './server-read';

const safeValueSchema = {
  safeParse(value: unknown) {
    if (
      typeof value === 'object' &&
      value !== null &&
      Object.keys(value).length === 1 &&
      (value as { value?: unknown }).value === 'safe'
    ) {
      return { success: true as const, data: { value: 'safe' as const } };
    }
    return { success: false as const };
  },
};

describe('server-only configured upstream reader', () => {
  beforeEach(() => {
    process.env.API_URL = 'http://api.internal:4000';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('uses the configured direct allowlisted URL, no-store and sanitized request context', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('http://api.internal:4000/api/home/dashboard');
      expect(init?.cache).toBe('no-store');
      expect(init?.redirect).toBe('manual');
      const headers = new Headers(init?.headers);
      expect(headers.get('authorization')).toBe('Bearer private');
      expect(headers.get('x-forwarded-for')).toBe('127.0.0.1');
      expect(headers.get('cookie')).toBeNull();
      expect(headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
      return Response.json({ value: 'safe', accessToken: 'must-not-pass-schema' });
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      readConfiguredUpstreamJson({
        path: '/api/home/dashboard',
        allowedPathPrefix: '/api',
        operation: 'home.dashboard.server_read',
        requestHeaders: new Headers({
          cookie: 'never-forward',
          'x-forwarded-for': '::ffff:127.0.0.1',
        }),
        authorization: 'Bearer private',
        responseSchema: safeValueSchema,
      }),
    ).resolves.toEqual({ ok: true, data: { value: 'safe' } });
  });

  it('fails closed for a path outside the allowlist without fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      readConfiguredUpstreamJson({
        path: '/auth/session',
        allowedPathPrefix: '/api',
        operation: 'home.dashboard.server_read',
        requestHeaders: new Headers(),
        responseSchema: safeValueSchema,
      }),
    ).resolves.toEqual({ ok: false, kind: 'invalid-config' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('separates abort, timeout, upstream status and schema failures without raw errors', async () => {
    const caller = new AbortController();
    caller.abort('private abort reason');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        if ((init as RequestInit).signal?.aborted) throw new DOMException('private', 'AbortError');
        return Response.json({ accessToken: 'secret' });
      }),
    );
    const base = {
      path: '/api/home/dashboard',
      allowedPathPrefix: '/api' as const,
      operation: 'home.dashboard.server_read',
      requestHeaders: new Headers(),
      responseSchema: safeValueSchema,
    };
    await expect(readConfiguredUpstreamJson({ ...base, signal: caller.signal })).resolves.toEqual({
      ok: false,
      kind: 'aborted',
    });
    await expect(readConfiguredUpstreamJson(base)).resolves.toEqual({
      ok: false,
      kind: 'invalid-response',
      status: 502,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 401 })),
    );
    await expect(readConfiguredUpstreamJson(base)).resolves.toEqual({
      ok: false,
      kind: 'upstream',
      status: 401,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 503 })),
    );
    await expect(readConfiguredUpstreamJson(base)).resolves.toEqual({
      ok: false,
      kind: 'upstream',
      status: 503,
    });
  });

  it('bounds a hanging upstream with the configured timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            (init as RequestInit).signal?.addEventListener(
              'abort',
              () => {
                reject(new DOMException('raw timeout detail', 'AbortError'));
              },
              { once: true },
            );
          }),
      ),
    );
    const pending = readConfiguredUpstreamJson({
      path: '/api/home/dashboard',
      allowedPathPrefix: '/api',
      operation: 'home.dashboard.server_read',
      requestHeaders: new Headers(),
      responseSchema: safeValueSchema,
      timeoutMs: 25,
    });
    await vi.advanceTimersByTimeAsync(25);
    await expect(pending).resolves.toEqual({ ok: false, kind: 'timeout' });
  });

  it.each([['timeout', undefined] as const, ['aborted', new AbortController()] as const])(
    'keeps %s protection active while consuming a response body',
    async (kind, caller) => {
      vi.useFakeTimers();
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_url, init) => {
          const signal = (init as RequestInit).signal;
          return new Response(
            new ReadableStream({
              start(controller) {
                signal?.addEventListener(
                  'abort',
                  () => {
                    controller.error(new DOMException('private body detail', 'AbortError'));
                  },
                  { once: true },
                );
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }),
      );
      const pending = readConfiguredUpstreamJson({
        path: '/api/home/dashboard',
        allowedPathPrefix: '/api',
        operation: 'home.dashboard.server_read',
        requestHeaders: new Headers(),
        responseSchema: safeValueSchema,
        timeoutMs: 25,
        signal: caller?.signal,
      });
      if (caller) caller.abort('private caller reason');
      else await vi.advanceTimersByTimeAsync(25);
      await expect(pending).resolves.toEqual({ ok: false, kind });
    },
  );
});

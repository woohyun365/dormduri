import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBffRequest } from '@/test/bff-route';
import { forwardBffRequest } from './forward';
import { setServerOperationalEventWriterForTests } from '@/observability/operational/server-runtime';
import type { OperationalEvent } from '@/observability/operational/operational-events';

describe('BFF operational reliability', () => {
  const events: OperationalEvent[] = [];
  const originalLogging = process.env.WEB_BFF_OPERATIONAL_LOGGING_ENABLED;
  const originalSuccessSampleRate = process.env.WEB_BFF_SUCCESS_SAMPLE_RATE;
  let restoreWriter: () => void = () => undefined;

  beforeEach(() => {
    process.env.WEB_BFF_OPERATIONAL_LOGGING_ENABLED = '1';
    process.env.WEB_BFF_SUCCESS_SAMPLE_RATE = '1';
    events.splice(0, events.length);
    restoreWriter = setServerOperationalEventWriterForTests((event) => {
      events.push(event);
    });
  });

  afterEach(() => {
    restoreWriter();
    vi.unstubAllGlobals();
    if (originalLogging === undefined) delete process.env.WEB_BFF_OPERATIONAL_LOGGING_ENABLED;
    else process.env.WEB_BFF_OPERATIONAL_LOGGING_ENABLED = originalLogging;
    if (originalSuccessSampleRate === undefined) delete process.env.WEB_BFF_SUCCESS_SAMPLE_RATE;
    else process.env.WEB_BFF_SUCCESS_SAMPLE_RATE = originalSuccessSampleRate;
  });

  it('success duration과 bounded operation만 기록하고 correlation을 upstream에 전달한다', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('x-request-id')).toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27}$/);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await forwardBffRequest({
      request: createBffRequest('/api/bookmarks?cursor=private-value'),
      method: 'GET',
      path: '/api/bookmarks?cursor=private-value',
      operation: 'bookmark.list',
      authenticated: true,
    });

    expect(response.status).toBe(200);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventName: 'web_bff_request_completed',
      operation: 'bookmark.list',
      outcome: 'success',
      statusClass: '2xx',
      authenticated: true,
      requestCorrelationPresent: true,
    });
    expect(JSON.stringify(events)).not.toContain('cursor=private-value');
  });

  it('network와 invalid response를 서로 다른 outcome으로 기록한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('network down'))),
    );
    const networkResponse = await forwardBffRequest({
      request: createBffRequest('/api/bookmarks'),
      method: 'GET',
      path: '/api/bookmarks',
      operation: 'bookmark.list',
    });
    expect(networkResponse.status).toBe(502);
    expect(events.at(-1)).toMatchObject({ outcome: 'network', statusClass: '5xx' });

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('not-json', { status: 200, headers: { 'Content-Type': 'text/plain' } }),
      ),
    );
    const invalidResponse = await forwardBffRequest({
      request: createBffRequest('/api/bookmarks'),
      method: 'GET',
      path: '/api/bookmarks',
      operation: 'bookmark.list',
    });
    expect(invalidResponse.status).toBe(502);
    expect(events.at(-1)).toMatchObject({ outcome: 'invalid_response', statusClass: '5xx' });
  });

  it('structured writer failure가 BFF response를 바꾸지 않는다', async () => {
    restoreWriter();
    restoreWriter = setServerOperationalEventWriterForTests(() => {
      throw new Error('log sink unavailable');
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const response = await forwardBffRequest({
      request: createBffRequest('/api/bookmarks'),
      method: 'GET',
      path: '/api/bookmarks',
      operation: 'bookmark.list',
    });
    await expect(response.json()).resolves.toEqual({ success: true });
  });
});

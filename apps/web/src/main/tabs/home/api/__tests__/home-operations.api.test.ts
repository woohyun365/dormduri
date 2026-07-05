import { afterEach, describe, expect, it, vi } from 'vitest';
import { homeOperationsApi, HomeOperationsFetchError } from '../home-operations.api';

function stubOperationsFetch(json: unknown, status = 200, contentType = 'application/json') {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    return new Response(JSON.stringify(json), {
      status,
      headers: { 'Content-Type': contentType },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('homeOperationsApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('HomeTab preview 책임으로 unread notification count만 BFF에서 읽는다', async () => {
    const fetchMock = stubOperationsFetch({ unreadCount: 2 });

    await expect(homeOperationsApi.getNotificationUnreadCount()).resolves.toEqual({
      unreadCount: 2,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notifications/unread-count',
      expect.objectContaining({ method: 'GET', cache: 'no-store' }),
    );
  });

  it('schema mismatch와 upstream error는 raw body를 노출하지 않는 typed error로 반환한다', async () => {
    stubOperationsFetch({ unreadCount: 'raw-invalid-value' });

    await expect(homeOperationsApi.getNotificationUnreadCount()).rejects.toMatchObject({
      name: 'HomeOperationsFetchError',
      code: 'HOME_OPERATIONS_UPSTREAM_INVALID',
      message: 'Home operations response did not match the public contract.',
    } satisfies Partial<HomeOperationsFetchError>);

    vi.unstubAllGlobals();
    stubOperationsFetch({ success: false, accessToken: 'must-not-leak' }, 500);

    await expect(homeOperationsApi.getNotificationUnreadCount()).rejects.toMatchObject({
      code: 'HOME_OPERATIONS_UPSTREAM_UNAVAILABLE',
      message: 'Home operations upstream returned an error status.',
      status: 500,
    } satisfies Partial<HomeOperationsFetchError>);
  });
});

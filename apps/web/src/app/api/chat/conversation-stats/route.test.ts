import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBffRequest, firstFetchInit, firstFetchInput, stubJsonFetch } from '@/test/bff-route';
import { GET } from './route';

const AUTH_TOKEN = `v1.session-chat.${'a'.repeat(43)}`;

describe('chat conversation stats BFF route', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('인증을 전달하고 public chat stats contract만 반환한다', async () => {
    const stats = {
      current: null,
      past: [{ seasonId: 'season-1', seasonName: '2026년 1학기', conversationUserCount: 4 }],
    };
    const fetchMock = stubJsonFetch(stats);

    const response = await GET(
      createBffRequest('/api/chat/conversation-stats', {
        headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(stats);
    expect(firstFetchInput(fetchMock)).toBe('http://localhost:4000/api/chat/conversation-stats');
    expect(firstFetchInit(fetchMock)).toMatchObject({
      method: 'GET',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });
  });

  it('내부 필드가 섞인 upstream 성공 응답은 fail-closed한다', async () => {
    stubJsonFetch({ current: null, past: [], internalThreadIds: ['thread-secret'] });

    const response = await GET(createBffRequest('/api/chat/conversation-stats'));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'BFF_UPSTREAM_SCHEMA_INVALID',
    });
  });
});

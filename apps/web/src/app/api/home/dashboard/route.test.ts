import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHomeDashboardFixture } from '@/__fixtures__/home-dashboard';
import { createBffRequest, firstFetchInit, firstFetchInput, stubJsonFetch } from '@/test/bff-route';
import { GET } from './route';

const AUTH_TOKEN = `v1.session-home.${'a'.repeat(43)}`;

function stubTextFetch(body: string, status = 200, contentType = 'text/plain') {
  const fetchMock = vi.fn(async () => {
    return new Response(body, {
      status,
      headers: { 'Content-Type': contentType },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('home dashboard BFF route', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cookie 인증을 Authorization으로 변환해서 upstream home dashboard를 no-store로 호출한다', async () => {
    const fixture = createHomeDashboardFixture();
    const fetchMock = stubJsonFetch(fixture);

    const response = await GET(
      createBffRequest('/api/home/dashboard', {
        headers: {
          Cookie: `auth-token=${AUTH_TOKEN}`,
          'x-forwarded-for': '203.0.113.24',
          'user-agent': 'vitest',
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(fixture);
    expect(firstFetchInput(fetchMock)).toBe('http://localhost:4000/api/home/dashboard');
    expect(firstFetchInit(fetchMock)).toMatchObject({
      method: 'GET',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'x-forwarded-for': '203.0.113.24',
        'user-agent': 'vitest',
      },
    });
  });

  it('성공 응답 schema가 dashboard contract와 다르면 502 safe error로 실패한다', async () => {
    stubJsonFetch({ season: null, accessToken: 'must-not-leak' });

    const response = await GET(createBffRequest('/api/home/dashboard'));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'BFF_UPSTREAM_SCHEMA_INVALID',
    });
  });

  it('upstream error JSON은 status를 유지하되 민감 필드를 제거한다', async () => {
    stubJsonFetch(
      {
        success: false,
        code: 'AUTH_REQUIRED',
        accessToken: 'must-not-leak',
      },
      401,
    );

    const response = await GET(createBffRequest('/api/home/dashboard'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'AUTH_REQUIRED',
    });
  });

  it('upstream non-json 응답은 body를 노출하지 않는 safe error로 변환한다', async () => {
    stubTextFetch('raw upstream stack with accessToken=must-not-leak', 200, 'text/html');

    const response = await GET(createBffRequest('/api/home/dashboard'));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'BFF_UPSTREAM_NON_JSON_RESPONSE',
    });
  });

  it('upstream malformed JSON 응답은 body를 노출하지 않는 safe error로 변환한다', async () => {
    stubTextFetch('{"accessToken":"must-not-leak"', 200, 'application/json');

    const response = await GET(createBffRequest('/api/home/dashboard'));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'BFF_UPSTREAM_MALFORMED_JSON_RESPONSE',
    });
  });

  it('public dashboard DTO 외 internal key가 섞이면 fail-closed한다', async () => {
    stubJsonFetch({
      ...createHomeDashboardFixture(),
      internalAudit: { retentionState: 'hidden', secret: 'must-not-leak' },
    });

    const response = await GET(createBffRequest('/api/home/dashboard'));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'BFF_UPSTREAM_SCHEMA_INVALID',
    });
  });

  it('upstream fetch 실패를 dashboard fallback 대신 safe error로 변환한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );

    const response = await GET(createBffRequest('/api/home/dashboard'));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'BFF_UPSTREAM_UNAVAILABLE',
    });
  });
});

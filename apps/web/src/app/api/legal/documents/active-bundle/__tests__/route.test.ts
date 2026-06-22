import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBffRequest, firstFetchInit, firstFetchInput, stubJsonFetch } from '@/test/bff-route';
import { getFallbackLegalDocumentsBundle } from '@/legal/api/legal-documents-bundle.api';
import { GET } from '../route';

const ACTIVE_BUNDLE = getFallbackLegalDocumentsBundle();

describe('active legal documents bundle BFF route', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('public active bundle만 upstream API로 전달하고 auth cookie는 전달하지 않는다', async () => {
    const fetchMock = stubJsonFetch(ACTIVE_BUNDLE);
    const request = createBffRequest('/api/legal/documents/active-bundle', {
      headers: {
        Cookie: 'auth-token=caller-token',
        Authorization: 'Bearer caller-token',
        'x-forwarded-for': '203.0.113.10',
      },
    });

    const response = await GET(request);

    expect(firstFetchInput(fetchMock)).toBe(
      'http://localhost:4000/api/legal/documents/active-bundle',
    );
    expect(firstFetchInit(fetchMock)).toEqual(
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        headers: expect.objectContaining({ Accept: 'application/json' }),
      }),
    );
    expect(firstFetchInit(fetchMock).headers).toEqual(
      expect.not.objectContaining({ Authorization: expect.any(String) }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toMatchObject({
      termsOfService: { id: ACTIVE_BUNDLE.termsOfService.id },
    });
  });

  it('upstream invalid bundle은 raw body 없이 safe error로 변환한다', async () => {
    stubJsonFetch({ termsOfService: { id: 'incomplete' }, secret: 'must-not-leak' });
    const request = createBffRequest('/api/legal/documents/active-bundle');

    const response = await GET(request);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'LEGAL_DOCUMENT_BUNDLE_UPSTREAM_INVALID',
    });
  });

  it('upstream error status는 public unavailable response로 변환한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify({ secret: 'must-not-leak' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
    const request = createBffRequest('/api/legal/documents/active-bundle');

    const response = await GET(request);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'LEGAL_DOCUMENT_BUNDLE_UPSTREAM_UNAVAILABLE',
    });
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { LegalDocumentKind } from '@repo/shared/legal';
import { createBffRequest, firstFetchInit, firstFetchInput, stubJsonFetch } from '@/test/bff-route';
import { LEGAL_FALLBACK_DOCUMENTS } from '@/legal/content/legal-fallback-documents';
import { GET } from '../route';

const TERMS_DOCUMENT = LEGAL_FALLBACK_DOCUMENTS[LegalDocumentKind.TERMS_OF_SERVICE];

describe('legal document BFF route', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('public legal document kind만 upstream API로 전달하고 auth cookie는 전달하지 않는다', async () => {
    const fetchMock = stubJsonFetch(TERMS_DOCUMENT);
    const request = createBffRequest('/api/legal/documents/TERMS_OF_SERVICE', {
      headers: {
        Cookie: 'auth-token=caller-token',
        Authorization: 'Bearer caller-token',
        'x-forwarded-for': '203.0.113.10',
      },
    });

    const response = await GET(request, { params: { kind: 'TERMS_OF_SERVICE' } });

    expect(firstFetchInput(fetchMock)).toBe(
      'http://localhost:4000/api/legal/documents/TERMS_OF_SERVICE/active',
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
    await expect(response.json()).resolves.toMatchObject({ id: TERMS_DOCUMENT.id });
  });

  it('unknown legal document kind는 upstream 호출 없이 fail-closed한다', async () => {
    const fetchMock = stubJsonFetch({ shouldNotForward: true });
    const request = createBffRequest('/api/legal/documents/DRAFT_POLICY');

    const response = await GET(request, { params: { kind: 'DRAFT_POLICY' } });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_LEGAL_DOCUMENT_KIND',
    });
  });

  it('upstream invalid body는 raw body 없이 safe error로 변환한다', async () => {
    stubJsonFetch({ id: 'draft-doc', draftBody: '<p>must not leak</p>' });
    const request = createBffRequest('/api/legal/documents/TERMS_OF_SERVICE');

    const response = await GET(request, { params: Promise.resolve({ kind: 'TERMS_OF_SERVICE' }) });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'LEGAL_DOCUMENT_UPSTREAM_INVALID',
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
    const request = createBffRequest('/api/legal/documents/PRIVACY_POLICY');

    const response = await GET(request, { params: { kind: 'PRIVACY_POLICY' } });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'LEGAL_DOCUMENT_UPSTREAM_UNAVAILABLE',
    });
  });
});

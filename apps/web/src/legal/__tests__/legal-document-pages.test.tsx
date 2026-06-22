import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LegalDocumentKind } from '@repo/shared/legal';
import TermsPage from '@/app/terms/page';
import PrivacyPage from '@/app/privacy/page';
import { LEGAL_FALLBACK_DOCUMENTS } from '../content/legal-fallback-documents';

function stubLegalDocumentFetch(document: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      return new Response(JSON.stringify(document), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
}

describe('public legal document pages', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('/terms는 API document를 fallback보다 우선해 렌더링한다', async () => {
    stubLegalDocumentFetch({
      ...LEGAL_FALLBACK_DOCUMENTS[LegalDocumentKind.TERMS_OF_SERVICE],
      id: 'terms-api-document',
      title: 'API 이용약관',
      version: 'terms-api-version',
    });

    render(await TermsPage());

    expect(screen.getByRole('heading', { level: 1, name: 'API 이용약관' })).toBeInTheDocument();
    expect(screen.getByText('terms-api-version')).toBeInTheDocument();
    expect(screen.queryByText(/저장된 공개 안내/)).not.toBeInTheDocument();
  });

  it('/privacy는 API 실패 시 seed-synced fallback document와 fallback notice를 렌더링한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );

    const { container } = render(await PrivacyPage());

    expect(
      screen.getByRole('heading', { level: 1, name: 'KNU 룸메 개인정보 처리방침' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('저장된 공개 안내를 표시');
    expect(screen.getByRole('navigation', { name: '문서 목차' })).toBeInTheDocument();
    expect(screen.getByText('서비스 처리 항목')).toBeInTheDocument();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });
});

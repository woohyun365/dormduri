import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LegalDocumentKind } from '@repo/shared/legal';
import TermsPage, { dynamic as termsDynamic, metadata as termsMetadata } from '@/app/terms/page';
import PrivacyPage, {
  dynamic as privacyDynamic,
  metadata as privacyMetadata,
} from '@/app/privacy/page';
import { LEGAL_FALLBACK_DOCUMENTS } from '../content/legal-fallback-documents';

const routerMock = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
}));

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

function setDocumentReferrer(value: string) {
  Object.defineProperty(document, 'referrer', {
    value,
    configurable: true,
  });
}

describe('public legal document pages', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    setDocumentReferrer('');
  });

  it('/terms와 /privacy는 공개 legal page를 동적 렌더링으로 유지한다', () => {
    expect(termsDynamic).toBe('force-dynamic');
    expect(privacyDynamic).toBe('force-dynamic');
  });

  it('/terms와 /privacy metadata title은 root template과 사이트명을 중복하지 않는다', () => {
    expect(termsMetadata.title).toBe('이용약관');
    expect(privacyMetadata.title).toBe('개인정보 처리방침');
  });

  it('/terms는 API document를 fallback보다 우선해 사용자용 시행본 label로 렌더링한다', async () => {
    stubLegalDocumentFetch({
      ...LEGAL_FALLBACK_DOCUMENTS[LegalDocumentKind.TERMS_OF_SERVICE],
      id: 'terms-api-document',
      title: 'API 이용약관',
      version: 'terms-api-version',
    });

    const { container } = render(await TermsPage());

    expect(screen.getByRole('heading', { level: 1, name: 'API 이용약관' })).toBeInTheDocument();
    expect(screen.getByText('2026년 6월 22일 시행본')).toBeInTheDocument();
    const homeLink = screen.getByRole('link', { name: '돔두리 홈으로' });
    expect(within(homeLink).getAllByRole('img')).toHaveLength(1);
    expect(within(homeLink).getByRole('img', { name: '돔두리' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^홈으로$/ })).not.toBeInTheDocument();
    const backButton = screen.getByRole('button', { name: '이전 화면으로 돌아가기' });
    expect(backButton).toBeInTheDocument();
    expect(backButton).toHaveTextContent('이전 화면으로');
    expect(backButton).toHaveClass('cursor-pointer', 'focus-visible:outline-offset-2');
    expect(container).not.toHaveTextContent('terms-api-version');
    expect(screen.queryByText(/서비스에 함께 배포된 공개 문서/)).not.toBeInTheDocument();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container).not.toHaveTextContent(/\.omx|draft|plan|apps\/web/i);
  });

  it('이전 화면 버튼은 직접 진입 시 홈으로 fallback 이동한다', async () => {
    stubLegalDocumentFetch(LEGAL_FALLBACK_DOCUMENTS[LegalDocumentKind.TERMS_OF_SERVICE]);

    render(await TermsPage());

    fireEvent.click(screen.getByRole('button', { name: '이전 화면으로 돌아가기' }));

    expect(routerMock.push).toHaveBeenCalledWith('/');
    expect(routerMock.back).not.toHaveBeenCalled();
  });

  it('이전 화면 버튼은 같은 출처 유입이면 브라우저 뒤로가기를 사용한다', async () => {
    setDocumentReferrer(`${window.location.origin}/signup`);
    stubLegalDocumentFetch(LEGAL_FALLBACK_DOCUMENTS[LegalDocumentKind.PRIVACY_POLICY]);

    render(await PrivacyPage());

    fireEvent.click(screen.getByRole('button', { name: '이전 화면으로 돌아가기' }));

    expect(routerMock.back).toHaveBeenCalledTimes(1);
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('/privacy는 API 실패 시 seed-synced fallback document와 사용자용 fallback notice를 렌더링한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );

    const { container } = render(await PrivacyPage());

    expect(
      screen.getByRole('heading', { level: 1, name: '돔두리 개인정보 처리방침' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('서비스에 함께 배포된 공개 문서');
    expect(screen.getByRole('status')).toHaveTextContent('서버의 최신 문서 기준으로 다시 확인');
    expect(screen.getByRole('navigation', { name: '문서 목차' })).toBeInTheDocument();
    expect(screen.getByText('문서 목차 먼저 보기')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '제1조(개인정보의 처리 목적)' }),
    ).toBeInTheDocument();
    expect(screen.getByText('처리하는 개인정보 항목')).toBeInTheDocument();
    expect(screen.getAllByText('제2조(처리하는 개인정보 항목 및 보유기간)').length).toBeGreaterThan(
      0,
    );
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container).not.toHaveTextContent(/\.omx|draft|plan|apps\/web/i);
    expect(container).not.toHaveTextContent(
      /privacy-\d{4}-\d{2}-\d{2}|active 사용자|user-facing|read model|payload|tombstone|cache|active 계정|ticket|공개 API/i,
    );
  });

  it('모바일 목차는 본문 heading보다 먼저 접근 가능하다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );

    render(await TermsPage());

    const mobileToc = screen.getByText('문서 목차 먼저 보기').closest('details');
    const firstBodyHeading = screen.getByRole('heading', { level: 2, name: '제1조(목적)' });

    expect(mobileToc).not.toBeNull();
    expect(
      mobileToc!.compareDocumentPosition(firstBodyHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('h2/h3/h4 heading은 semantic level과 시각 class가 구분된다', async () => {
    stubLegalDocumentFetch({
      ...LEGAL_FALLBACK_DOCUMENTS[LegalDocumentKind.TERMS_OF_SERVICE],
      sections: [
        { type: 'heading', level: 2, text: '제1조(큰 항목)' },
        { type: 'heading', level: 3, text: '하위 항목' },
        { type: 'heading', level: 4, text: '세부 항목' },
      ],
    });

    render(await TermsPage());

    expect(screen.getByRole('heading', { level: 2, name: '제1조(큰 항목)' })).toHaveClass(
      'border-t',
      'border-l-4',
      'pt-5',
      'text-xl',
    );
    expect(screen.getByRole('heading', { level: 3, name: '하위 항목' })).toHaveClass('text-lg');
    expect(screen.getByRole('heading', { level: 4, name: '세부 항목' })).toHaveClass('text-base');
  });

  it('문서 활용 action은 인쇄와 링크 복사를 제공한다', async () => {
    const print = vi.fn();
    const writeText = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    Object.defineProperty(window, 'print', { value: print, configurable: true });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    stubLegalDocumentFetch(LEGAL_FALLBACK_DOCUMENTS[LegalDocumentKind.TERMS_OF_SERVICE]);

    render(await TermsPage());

    fireEvent.click(screen.getByRole('button', { name: '인쇄하기' }));
    fireEvent.click(screen.getByRole('button', { name: '링크 복사' }));

    expect(print).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(window.location.href));
    expect(await screen.findByRole('status')).toHaveTextContent('현재 문서 링크를 복사했습니다.');
  });
});

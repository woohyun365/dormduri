import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LegalDocumentKind } from '@repo/shared/legal';
import TermsPage, { dynamic as termsDynamic, metadata as termsMetadata } from '@/app/terms/page';
import PrivacyPage, {
  dynamic as privacyDynamic,
  metadata as privacyMetadata,
} from '@/app/privacy/page';
import { writeLegalLastSuccess } from '../api/legal-last-success.store';
import { seedLegalDocumentPage } from '../testing/legal-seed-documents';

const routerMock = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
}));

const termsPage = seedLegalDocumentPage(LegalDocumentKind.TERMS_OF_SERVICE)!;
const privacyPage = seedLegalDocumentPage(LegalDocumentKind.PRIVACY_POLICY)!;

function stubLegalDocumentFetch(body: unknown, status = 200) {
  const fetcher = vi.fn<typeof fetch>(async () => {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}

function stubOfflineFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('offline');
    }),
  );
}

function route(version?: string | string[]) {
  return { searchParams: Promise.resolve(version === undefined ? {} : { version }) };
}

function withTitle(page: typeof termsPage, title: string) {
  return { ...page, viewing: { ...page.viewing, title } };
}

function sourceMarker(container: HTMLElement) {
  return container
    .querySelector('[data-dormduri-legal-source]')
    ?.getAttribute('data-dormduri-legal-source');
}

function setDocumentReferrer(value: string) {
  Object.defineProperty(document, 'referrer', {
    value,
    configurable: true,
  });
}

let lastSuccessDirectory: string;

describe('public legal document pages', () => {
  beforeEach(() => {
    lastSuccessDirectory = mkdtempSync(join(tmpdir(), 'legal-route-'));
    vi.stubEnv('DORMDURI_LEGAL_LAST_SUCCESS_DIR', lastSuccessDirectory);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    setDocumentReferrer('');
    rmSync(lastSuccessDirectory, { recursive: true, force: true });
  });

  it('/terms와 /privacy는 공개 legal page를 동적 렌더링으로 유지한다', () => {
    expect(termsDynamic).toBe('force-dynamic');
    expect(privacyDynamic).toBe('force-dynamic');
  });

  it('/terms와 /privacy metadata title은 root template과 사이트명을 중복하지 않는다', () => {
    expect(termsMetadata.title).toBe('이용약관');
    expect(privacyMetadata.title).toBe('개인정보 처리방침');
  });

  it('/terms는 API 게시본을 사용자용 시행본 label과 게시본 출처 표지로 렌더링한다', async () => {
    const fetcher = stubLegalDocumentFetch({
      ...withTitle(termsPage, 'API 이용약관'),
      viewing: { ...termsPage.viewing, title: 'API 이용약관', version: 'terms-api-version' },
    });

    const { container } = render(await TermsPage(route()));

    expect(String(fetcher.mock.calls[0]?.[0])).toMatch(
      /\/api\/legal\/documents\/TERMS_OF_SERVICE\/page$/u,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'API 이용약관' })).toBeInTheDocument();
    expect(screen.getByText('2026년 6월 22일 시행본')).toBeInTheDocument();
    expect(sourceMarker(container)).toBe('published');
    const homeLink = screen.getByRole('link', { name: '돔두리 홈으로' });
    expect(within(homeLink).getAllByRole('img')).toHaveLength(1);
    expect(within(homeLink).getByRole('img', { name: '돔두리' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^홈으로$/ })).not.toBeInTheDocument();
    const backButton = screen.getByRole('button', { name: '이전 화면으로 돌아가기' });
    expect(backButton).toBeInTheDocument();
    expect(backButton).toHaveTextContent('이전 화면으로');
    expect(backButton).toHaveClass('cursor-pointer', 'focus-visible:outline-offset-2');
    expect(container).not.toHaveTextContent('terms-api-version');
    expect(screen.queryByText(/마지막으로 확인한/)).not.toBeInTheDocument();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container).not.toHaveTextContent(/\.omx|draft|plan|apps\/web/i);
  });

  it('/privacy?version=은 그 시행일 판을 API에 묻고 보인다', async () => {
    const historical = seedLegalDocumentPage(LegalDocumentKind.PRIVACY_POLICY, '2026-06-22')!;
    const fetcher = stubLegalDocumentFetch(historical);

    const { container } = render(await PrivacyPage(route('2026-06-22')));

    expect(String(fetcher.mock.calls[0]?.[0])).toMatch(/\/page\?version=2026-06-22$/u);
    expect(screen.getByText('2026년 6월 22일 시행본')).toBeInTheDocument();
    expect(sourceMarker(container)).toBe('published');
  });

  it('이전 화면 버튼은 직접 진입 시 홈으로 fallback 이동한다', async () => {
    stubLegalDocumentFetch(termsPage);

    render(await TermsPage(route()));

    fireEvent.click(screen.getByRole('button', { name: '이전 화면으로 돌아가기' }));

    expect(routerMock.push).toHaveBeenCalledWith('/');
    expect(routerMock.back).not.toHaveBeenCalled();
  });

  it('이전 화면 버튼은 같은 출처 유입이면 브라우저 뒤로가기를 사용한다', async () => {
    setDocumentReferrer(`${window.location.origin}/signup`);
    stubLegalDocumentFetch(privacyPage);

    render(await PrivacyPage(route()));

    fireEvent.click(screen.getByRole('button', { name: '이전 화면으로 돌아가기' }));

    expect(routerMock.back).toHaveBeenCalledTimes(1);
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  // The API fails and this Web kept the last response of the same request.
  it('/privacy는 API 실패 시 마지막으로 확인한 판을 확인 시각 안내와 함께 렌더링한다', async () => {
    await writeLegalLastSuccess(
      { endpoint: 'page', kind: LegalDocumentKind.PRIVACY_POLICY, versionKey: 'current' },
      privacyPage,
      new Date('2026-11-25T09:30:00.000Z'),
      { directory: lastSuccessDirectory },
    );
    stubOfflineFetch();

    const { container } = render(await PrivacyPage(route()));

    expect(
      screen.getByRole('heading', { level: 1, name: '돔두리 개인정보 처리방침' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('마지막으로 확인한 문서');
    expect(screen.getByRole('status')).toHaveTextContent('2026년 11월 25일 18:30');
    expect(sourceMarker(container)).toBe('last-success');
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
    expect(container).not.toHaveTextContent(/\.omx|draft|plan|apps\/web|함께 배포된/i);
    expect(container).not.toHaveTextContent(
      /privacy-\d{4}-\d{2}-\d{2}|active 사용자|user-facing|read model|payload|tombstone|cache|active 계정|ticket|공개 API/i,
    );
  });

  // The API fails and there is no kept response: no Web copy of the document exists.
  it('/privacy는 API 실패이고 마지막 성공본이 없으면 불러올 수 없음 화면을 렌더링한다', async () => {
    stubOfflineFetch();

    const { container } = render(await PrivacyPage(route()));

    expect(
      screen.getByRole('heading', { level: 1, name: '문서를 불러오지 못했습니다' }),
    ).toBeInTheDocument();
    expect(container).not.toHaveTextContent('제1조(개인정보의 처리 목적)');
    expect(sourceMarker(container)).toBeUndefined();
  });

  // A version address the API does not have (withdrawn or unknown).
  it('/privacy?version=은 API가 없는 판이라고 하면 없는 판 화면을 렌더링한다', async () => {
    stubLegalDocumentFetch({ code: 'LEGAL_DOCUMENT_VERSION_NOT_FOUND', message: 'x' }, 404);

    const { container } = render(await PrivacyPage(route('2026-01-01')));

    expect(
      screen.getByRole('heading', { level: 1, name: '해당 시행일의 문서를 찾을 수 없습니다' }),
    ).toBeInTheDocument();
    expect(container).not.toHaveTextContent('제1조(개인정보의 처리 목적)');
    expect(sourceMarker(container)).toBeUndefined();
  });

  it('/terms?version=의 형식이 틀리면 API를 부르지 않고 없는 판 화면을 렌더링한다', async () => {
    const fetcher = stubLegalDocumentFetch(termsPage);

    render(await TermsPage(route('next')));

    expect(fetcher).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', { level: 1, name: '해당 시행일의 문서를 찾을 수 없습니다' }),
    ).toBeInTheDocument();
  });

  // legal-basis.md LB-R10: the change summary and last modified date of the version shown.
  it('/privacy는 적용일과 주요 변경을 변경 요약과 최종 수정일로 화면에 안내한다', async () => {
    stubLegalDocumentFetch(privacyPage);

    const { container } = render(await PrivacyPage(route()));

    expect(container).toHaveTextContent('변경 요약');
    expect(container).toHaveTextContent('2026년 11월 20일부터 적용합니다.');
    expect(container).toHaveTextContent(
      '주요 변경: 개인정보처리시스템 접속 기록 보관 기간을 1년에서 2년으로',
    );
    expect(screen.getAllByText('2026-11-20').length).toBeGreaterThan(0);
  });

  it('모바일 목차는 본문 heading보다 먼저 접근 가능하다', async () => {
    stubLegalDocumentFetch(termsPage);

    render(await TermsPage(route()));

    const mobileToc = screen.getByText('문서 목차 먼저 보기').closest('details');
    const firstBodyHeading = screen.getByRole('heading', { level: 2, name: '제1조(목적)' });

    expect(mobileToc).not.toBeNull();
    expect(
      mobileToc!.compareDocumentPosition(firstBodyHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('h2/h3/h4 heading은 semantic level과 시각 class가 구분된다', async () => {
    stubLegalDocumentFetch({
      ...termsPage,
      viewing: {
        ...termsPage.viewing,
        sections: [
          { type: 'heading', level: 2, text: '제1조(큰 항목)' },
          { type: 'heading', level: 3, text: '하위 항목' },
          { type: 'heading', level: 4, text: '세부 항목' },
        ],
      },
    });

    render(await TermsPage(route()));

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
    stubLegalDocumentFetch(termsPage);

    render(await TermsPage(route()));

    fireEvent.click(screen.getByRole('button', { name: '인쇄하기' }));
    fireEvent.click(screen.getByRole('button', { name: '링크 복사' }));

    expect(print).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(window.location.href));
    expect(await screen.findByRole('status')).toHaveTextContent('현재 문서 링크를 복사했습니다.');
  });
});

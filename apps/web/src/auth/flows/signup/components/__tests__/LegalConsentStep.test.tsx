import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { LegalConsentStep, type LegalConsentData } from '../LegalConsentStep';
import { getFallbackLegalDocumentsBundle } from '@/legal/api/legal-documents-bundle.api';

vi.mock('lucide-react', () => ({
  FileText: () => null,
  X: () => null,
}));

const legalBundle = getFallbackLegalDocumentsBundle();
const emptyLegalConsent: LegalConsentData = {
  agreeAge: false,
  agreeTerms: false,
  agreePersonalDataCollectionUse: false,
};

function stubBundleFetch(bundle: unknown = legalBundle, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      return new Response(JSON.stringify(bundle), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
}

function renderWithState(
  overrides: { onNext?: () => void; notice?: string; initialLegalConsent?: LegalConsentData } = {},
) {
  const onNext = overrides.onNext ?? vi.fn<() => void>();
  const onBack = vi.fn<() => void>();

  function Wrapper() {
    const [legalConsent, setLegalConsent] = useState<LegalConsentData>(
      overrides.initialLegalConsent ?? emptyLegalConsent,
    );
    return (
      <LegalConsentStep
        legalConsent={legalConsent}
        onLegalConsentChange={setLegalConsent}
        onNext={onNext}
        onBack={onBack}
        notice={overrides.notice}
      />
    );
  }

  return { ...render(<Wrapper />), onNext, onBack };
}

describe('LegalConsentStep', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('style');
  });

  it('legal bundle loading 중에는 다음 단계 CTA를 비활성화하고 이유를 안내한다', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => await new Promise<Response>(() => {})),
    );

    renderWithState();

    expect(screen.getByRole('status')).toHaveTextContent('최신 동의 항목을 불러오는 중');
    expect(screen.getByRole('status')).toHaveTextContent('약관 정보가 준비되면');
    expect(screen.getByRole('button', { name: '다음 단계' })).toBeDisabled();
  });

  it('개인정보 처리방침 동의 checkbox 대신 개인정보 수집·이용 동의 요약을 보여준다', async () => {
    stubBundleFetch();
    renderWithState();

    expect(
      await screen.findByLabelText('[필수] 개인정보 수집·이용에 동의합니다'),
    ).toBeInTheDocument();
    expect(screen.queryByText('[필수] 개인정보 처리방침에 동의합니다')).not.toBeInTheDocument();
    expect(screen.getByText(/목적: 회원가입/)).toBeInTheDocument();
    expect(screen.getByText(/항목: 이메일/)).toBeInTheDocument();
    expect(screen.getByText(/보유기간: 탈퇴/)).toBeInTheDocument();
    expect(screen.getByText(/거부권: 필수 수집/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '처리방침 보기' })).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
  });

  it('미동의 상태에서 다음 클릭 시 구체적인 에러를 표시한다', async () => {
    stubBundleFetch();
    const { onNext } = renderWithState();

    await screen.findByLabelText('[필수] 이용약관에 동의합니다');
    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

    expect(screen.getByText('필수 확인·동의 항목을 모두 체크해주세요.')).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('전체 동의 체크 후 다음 클릭 시 onNext가 호출되고 legal ids를 상태에 유지한다', async () => {
    stubBundleFetch();
    const { onNext } = renderWithState();

    await screen.findByLabelText('[필수] 이용약관에 동의합니다');
    fireEvent.click(screen.getByRole('checkbox', { name: '필수 항목 전체 동의' }));
    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

    expect(onNext).toHaveBeenCalled();
  });

  it('active bundle legal ids를 submit evidence로 유지한다', async () => {
    const activeBundle = {
      termsOfService: { ...legalBundle.termsOfService, id: 'terms-active-id' },
      privacyPolicy: { ...legalBundle.privacyPolicy, id: 'privacy-active-id' },
      personalDataCollectionUseConsent: {
        ...legalBundle.personalDataCollectionUseConsent,
        id: 'personal-data-active-id',
      },
      age14OrAboveNotice: { ...legalBundle.age14OrAboveNotice, id: 'age-active-id' },
    };
    stubBundleFetch(activeBundle);
    const onNext = vi.fn<() => void>();
    let latestConsent: LegalConsentData = emptyLegalConsent;

    function Wrapper() {
      const [legalConsent, setLegalConsent] = useState<LegalConsentData>(emptyLegalConsent);
      return (
        <LegalConsentStep
          legalConsent={legalConsent}
          onLegalConsentChange={(nextConsent) => {
            latestConsent = nextConsent;
            setLegalConsent(nextConsent);
          }}
          onNext={onNext}
          onBack={vi.fn()}
        />
      );
    }

    render(<Wrapper />);

    await screen.findByLabelText('[필수] 이용약관에 동의합니다');
    fireEvent.click(screen.getByRole('checkbox', { name: '필수 항목 전체 동의' }));
    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

    expect(onNext).toHaveBeenCalled();
    expect(latestConsent.legalAcceptances).toEqual({
      termsVersionId: 'terms-active-id',
      personalDataConsentVersionId: 'personal-data-active-id',
      ageNoticeVersionId: 'age-active-id',
      privacyPolicyVersionIdShown: 'privacy-active-id',
    });
    expect(latestConsent.legalBundleSource).toBe('api');
  });

  it('active bundle id가 바뀌면 기존 필수 동의 체크를 reset한다', async () => {
    const activeBundle = {
      termsOfService: { ...legalBundle.termsOfService, id: 'terms-new-id' },
      privacyPolicy: { ...legalBundle.privacyPolicy, id: 'privacy-new-id' },
      personalDataCollectionUseConsent: {
        ...legalBundle.personalDataCollectionUseConsent,
        id: 'personal-data-new-id',
      },
      age14OrAboveNotice: { ...legalBundle.age14OrAboveNotice, id: 'age-new-id' },
    };
    stubBundleFetch(activeBundle);

    renderWithState({
      initialLegalConsent: {
        agreeAge: true,
        agreeTerms: true,
        agreePersonalDataCollectionUse: true,
        legalAcceptances: {
          termsVersionId: 'terms-old-id',
          personalDataConsentVersionId: 'personal-data-old-id',
          ageNoticeVersionId: 'age-old-id',
          privacyPolicyVersionIdShown: 'privacy-old-id',
        },
        legalBundleSource: 'api',
      },
    });

    await screen.findByLabelText('[필수] 이용약관에 동의합니다');

    expect(screen.getByRole('checkbox', { name: '필수 항목 전체 동의' })).not.toBeChecked();
    expect(screen.getByLabelText('[필수] 만 14세 이상입니다')).not.toBeChecked();
    expect(screen.getByLabelText('[필수] 이용약관에 동의합니다')).not.toBeChecked();
    expect(screen.getByLabelText('[필수] 개인정보 수집·이용에 동의합니다')).not.toBeChecked();
  });

  it('개별 항목을 모두 체크하면 다음으로 진행할 수 있다', async () => {
    stubBundleFetch();
    const { onNext } = renderWithState();

    fireEvent.click(await screen.findByRole('checkbox', { name: /만 14세/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /이용약관/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /개인정보 수집·이용/ }));
    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

    expect(onNext).toHaveBeenCalled();
  });

  it('전문 보기 dialog는 ESC로 닫고 focus를 버튼으로 복원한다', async () => {
    stubBundleFetch();
    renderWithState();

    const termsButton = (await screen.findAllByRole('button', { name: '전문 보기' }))[1]!;
    termsButton.focus();
    fireEvent.click(termsButton);

    expect(screen.getByRole('dialog', { name: /KNU 룸메 이용약관/ })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(termsButton);
  });

  it('전문 보기 dialog는 close button과 Tab focus trap을 제공한다', async () => {
    stubBundleFetch();
    renderWithState();

    const termsButton = (await screen.findAllByRole('button', { name: '전문 보기' }))[1]!;
    termsButton.focus();
    fireEvent.click(termsButton);

    const dialog = screen.getByRole('dialog', { name: /KNU 룸메 이용약관/ });
    const closeButton = screen.getByRole('button', { name: '문서 닫기' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(closeButton).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(closeButton).toHaveFocus();

    fireEvent.click(closeButton);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(termsButton);
  });

  it('전문 보기 dialog는 외부 scroll을 잠그고 overlay close 후 기존 document style을 복원한다', async () => {
    stubBundleFetch();
    document.body.style.overflow = 'auto';
    document.body.style.position = 'relative';
    document.body.style.top = '1px';
    document.body.style.left = '2px';
    document.body.style.right = '3px';
    document.body.style.width = 'calc(100% - 4px)';
    document.documentElement.style.overflow = 'clip';
    const scrollToMock = vi.mocked(window.scrollTo);
    scrollToMock.mockClear();
    renderWithState();

    const termsButton = (await screen.findAllByRole('button', { name: '전문 보기' }))[1]!;
    fireEvent.click(termsButton);

    const dialog = screen.getByRole('dialog', { name: /KNU 룸메 이용약관/ });
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('0px');
    expect(document.body.style.left).toBe('0px');
    expect(document.body.style.right).toBe('0px');
    expect(document.body.style.width).toBe('100%');
    expect(document.documentElement.style.overflow).toBe('hidden');

    fireEvent.click(dialog.parentElement!);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.body.style.overflow).toBe('auto');
    expect(document.body.style.position).toBe('relative');
    expect(document.body.style.top).toBe('1px');
    expect(document.body.style.left).toBe('2px');
    expect(document.body.style.right).toBe('3px');
    expect(document.body.style.width).toBe('calc(100% - 4px)');
    expect(document.documentElement.style.overflow).toBe('clip');
    expect(scrollToMock).toHaveBeenCalledWith(0, 0);
  });

  it('summary card와 dialog는 모바일 화면에서 스크롤 가능한 최소 touch target class를 유지한다', async () => {
    stubBundleFetch();
    renderWithState();

    const termsButton = (await screen.findAllByRole('button', { name: '전문 보기' }))[1]!;
    expect(termsButton).toHaveClass('min-h-11');
    fireEvent.click(termsButton);

    const dialog = screen.getByRole('dialog', { name: /KNU 룸메 이용약관/ });
    expect(dialog).toHaveClass('max-h-[86vh]', 'overscroll-contain', 'overflow-hidden');
    expect(screen.getByTestId('legal-document-dialog-scroll-area')).toHaveClass(
      'max-h-[68vh]',
      'overscroll-contain',
      'overflow-y-auto',
    );
  });

  it('active bundle fetch 실패 시 seed-synced fallback 안내를 표시한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    renderWithState();

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('저장된 안내를 표시'));
    expect(screen.getByLabelText('[필수] 이용약관에 동의합니다')).toBeInTheDocument();
  });

  it('fallback document를 표시한 경우에도 fallback legal ids를 submit evidence로 유지한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    const onNext = vi.fn<() => void>();
    let latestConsent: LegalConsentData = emptyLegalConsent;

    function Wrapper() {
      const [legalConsent, setLegalConsent] = useState<LegalConsentData>(emptyLegalConsent);
      return (
        <LegalConsentStep
          legalConsent={legalConsent}
          onLegalConsentChange={(nextConsent) => {
            latestConsent = nextConsent;
            setLegalConsent(nextConsent);
          }}
          onNext={onNext}
          onBack={vi.fn()}
        />
      );
    }

    render(<Wrapper />);

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('저장된 안내를 표시'));
    fireEvent.click(screen.getByRole('checkbox', { name: '필수 항목 전체 동의' }));
    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

    expect(onNext).toHaveBeenCalled();
    expect(latestConsent.legalAcceptances).toEqual({
      termsVersionId: legalBundle.termsOfService.id,
      personalDataConsentVersionId: legalBundle.personalDataCollectionUseConsent.id,
      ageNoticeVersionId: legalBundle.age14OrAboveNotice.id,
      privacyPolicyVersionIdShown: legalBundle.privacyPolicy.id,
    });
    expect(latestConsent.legalBundleSource).toBe('fallback');
  });

  it('stale 안내가 전달되면 사용자에게 재확인을 요구한다', async () => {
    stubBundleFetch();
    renderWithState({
      notice:
        '약관 또는 개인정보 동의 내용이 변경되었습니다. 최신 내용을 다시 확인하고 필수 항목에 다시 동의해주세요.',
    });

    expect(await screen.findByRole('status')).toHaveTextContent(
      '약관 또는 개인정보 동의 내용이 변경',
    );
  });
});

import React, { useCallback, useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { LegalConsentStep, type LegalConsentData } from '../LegalConsentStep';
import { seedActiveLegalDocumentsBundle } from '@/legal/test-support/legal-seed-documents';

vi.mock('lucide-react', () => ({
  AlertCircle: () => null,
  CheckCircle: () => null,
  FileText: () => null,
  ChevronRight: () => null,
  Info: () => null,
  Timer: () => null,
  WifiOff: () => null,
  X: () => null,
}));

const legalBundle = seedActiveLegalDocumentsBundle();
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
  overrides: {
    onNext?: () => void;
    requiresReconfirmation?: boolean;
    initialLegalConsent?: LegalConsentData;
  } = {},
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
        requiresReconfirmation={overrides.requiresReconfirmation}
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

    expect(screen.getByRole('status')).toHaveTextContent('필수 내용을 불러오고 있어요');
    expect(screen.getByRole('status')).toHaveTextContent('잠시만 기다려 주세요');
    expect(screen.getByRole('button', { name: '다음 단계' })).toBeDisabled();
  });

  it('개인정보 처리방침 동의 checkbox 대신 개인정보 수집·이용 동의 요약을 보여준다', async () => {
    stubBundleFetch();
    renderWithState();

    expect(await screen.findByLabelText('[필수] 개인정보 수집·이용 동의')).toBeInTheDocument();
    expect(screen.queryByText('[필수] 개인정보 처리방침에 동의합니다')).not.toBeInTheDocument();
    expect(screen.getByText('목적')).toBeInTheDocument();
    expect(screen.getByText(/계정 생성/)).toBeInTheDocument();
    expect(screen.getByText('항목')).toBeInTheDocument();
    expect(screen.getByText(/이메일·닉네임·학교 정보/)).toBeInTheDocument();
    expect(screen.getByText('보유기간')).toBeInTheDocument();
    expect(screen.getByText(/탈퇴 또는 목적 달성/)).toBeInTheDocument();
    expect(screen.getByText('별도 보관')).toBeInTheDocument();
    expect(screen.getByText(/신고·분쟁·법령상 필요한 기록/)).toBeInTheDocument();
    expect(screen.getByText('거부 시')).toBeInTheDocument();
    expect(screen.getByText(/동의하지 않으면 가입할 수 없어요/)).toBeInTheDocument();
    expect(
      screen.getByText('서비스를 이용할 때 알아두고 지켜야 할 내용을 확인해요.'),
    ).toBeInTheDocument();
    expect(screen.getByText('내 정보가 어떻게 이용되고 보호되는지 확인해요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '처리방침 보기' })).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
  });

  it('미동의 상태에서 다음 클릭 시 구체적인 에러를 표시한다', async () => {
    stubBundleFetch();
    const { onNext } = renderWithState();

    await screen.findByLabelText('[필수] 이용약관 동의');
    const firstUnchecked = screen.getByLabelText('[필수] 만 14세 이상이에요');
    const scrollIntoView = vi.fn();
    Object.defineProperty(firstUnchecked, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

    const error = screen.getByText('필수 확인·동의 항목을 모두 선택해 주세요.');
    expect(error).toBeInTheDocument();
    expect(firstUnchecked).toHaveFocus();
    expect(firstUnchecked).toHaveAttribute('aria-invalid', 'true');
    expect(firstUnchecked).toHaveAttribute('aria-describedby', error.id);
    expect(firstUnchecked).toHaveClass('border-rose-400', 'ring-1', 'ring-rose-300');
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(onNext).not.toHaveBeenCalled();
  });

  it('오류 이후에는 모두 동의할 때까지 남은 미동의 항목을 오류와 연결한다', async () => {
    stubBundleFetch();
    renderWithState();

    await screen.findByLabelText('[필수] 이용약관 동의');
    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));
    fireEvent.click(screen.getByLabelText('[필수] 만 14세 이상이에요'));

    expect(screen.queryByText('필수 확인·동의 항목을 모두 선택해 주세요.')).toBeInTheDocument();
    expect(screen.getByLabelText('[필수] 만 14세 이상이에요')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('[필수] 이용약관 동의')).toHaveAttribute('aria-invalid', 'true');
  });

  it('전체 동의 체크 후 다음 클릭 시 onNext가 호출되고 legal ids를 상태에 유지한다', async () => {
    stubBundleFetch();
    const { onNext } = renderWithState();

    await screen.findByLabelText('[필수] 이용약관 동의');
    fireEvent.click(screen.getByRole('checkbox', { name: '필수 항목 모두 동의' }));
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
      const handleLegalConsentChange = useCallback((nextConsent: LegalConsentData) => {
        latestConsent = nextConsent;
        setLegalConsent(nextConsent);
      }, []);

      return (
        <LegalConsentStep
          legalConsent={legalConsent}
          onLegalConsentChange={handleLegalConsentChange}
          onNext={onNext}
          onBack={vi.fn()}
        />
      );
    }

    render(<Wrapper />);

    await screen.findByLabelText('[필수] 이용약관 동의');
    fireEvent.click(screen.getByRole('checkbox', { name: '필수 항목 모두 동의' }));
    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

    expect(onNext).toHaveBeenCalled();
    expect(latestConsent.legalAcceptances).toEqual({
      termsVersionId: 'terms-active-id',
      personalDataConsentVersionId: 'personal-data-active-id',
      ageNoticeVersionId: 'age-active-id',
      privacyPolicyVersionIdShown: 'privacy-active-id',
    });
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
      },
    });

    await screen.findByLabelText('[필수] 이용약관 동의');

    expect(screen.getByRole('checkbox', { name: '필수 항목 모두 동의' })).not.toBeChecked();
    expect(screen.getByLabelText('[필수] 만 14세 이상이에요')).not.toBeChecked();
    expect(screen.getByLabelText('[필수] 이용약관 동의')).not.toBeChecked();
    expect(screen.getByLabelText('[필수] 개인정보 수집·이용 동의')).not.toBeChecked();
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

    const termsButton = await screen.findByRole('button', {
      name: '이용약관 동의 내용 보기',
    });
    termsButton.focus();
    fireEvent.click(termsButton);

    expect(screen.getByRole('dialog', { name: /돔두리 이용약관/ })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(termsButton);
  });

  it('전문 보기 dialog는 close button과 Tab focus trap을 제공한다', async () => {
    stubBundleFetch();
    renderWithState();

    const termsButton = await screen.findByRole('button', {
      name: '이용약관 동의 내용 보기',
    });
    termsButton.focus();
    fireEvent.click(termsButton);

    const dialog = screen.getByRole('dialog', { name: /돔두리 이용약관/ });
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

  it('전문 보기 dialog는 sticky 기준을 유지하며 외부 scroll을 잠그고 기존 style을 복원한다', async () => {
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

    const termsButton = await screen.findByRole('button', {
      name: '이용약관 동의 내용 보기',
    });
    fireEvent.click(termsButton);

    const dialog = screen.getByRole('dialog', { name: /돔두리 이용약관/ });
    expect(document.body.style.overflow).toBe('clip');
    expect(document.body.style.position).toBe('relative');
    expect(document.body.style.top).toBe('1px');
    expect(document.body.style.left).toBe('2px');
    expect(document.body.style.right).toBe('3px');
    expect(document.body.style.width).toBe('calc(100% - 4px)');
    expect(document.documentElement.style.overflow).toBe('clip');

    fireEvent.click(dialog.parentElement!);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.body.style.overflow).toBe('auto');
    expect(document.body.style.position).toBe('relative');
    expect(document.body.style.top).toBe('1px');
    expect(document.body.style.left).toBe('2px');
    expect(document.body.style.right).toBe('3px');
    expect(document.body.style.width).toBe('calc(100% - 4px)');
    expect(document.documentElement.style.overflow).toBe('clip');
    expect(scrollToMock).not.toHaveBeenCalled();
  });

  it('summary card와 dialog는 모바일 화면에서 스크롤 가능한 최소 touch target class를 유지한다', async () => {
    stubBundleFetch();
    renderWithState();

    const termsButton = await screen.findByRole('button', {
      name: '이용약관 동의 내용 보기',
    });
    expect(termsButton).toHaveClass('min-h-11');
    fireEvent.click(termsButton);

    const dialog = screen.getByRole('dialog', { name: /돔두리 이용약관/ });
    expect(dialog).toHaveClass('max-h-[86vh]', 'overscroll-contain', 'overflow-hidden');
    expect(screen.getByTestId('legal-document-dialog-scroll-area')).toHaveClass(
      'max-h-[68vh]',
      'overscroll-contain',
      'overflow-y-auto',
    );
  });

  // Without the bundle there are no version ids to agree to, so signup stops at this step.
  it.each([
    [
      'a connection failure',
      async () => {
        throw new Error('offline');
      },
    ],
    [
      'an API error',
      async () =>
        new Response(JSON.stringify({ code: 'LEGAL_DOCUMENTS_UNAVAILABLE', message: 'x' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }),
    ],
  ])(
    'active bundle을 못 읽으면(%s) 지금은 가입할 수 없음을 알리고 제출을 막는다',
    async (_label, respond) => {
      vi.stubGlobal('fetch', vi.fn(respond));
      const onNext = vi.fn<() => void>();
      let latestConsent: LegalConsentData = emptyLegalConsent;

      function Wrapper() {
        const [legalConsent, setLegalConsent] = useState<LegalConsentData>(emptyLegalConsent);
        const handleLegalConsentChange = useCallback((nextConsent: LegalConsentData) => {
          latestConsent = nextConsent;
          setLegalConsent(nextConsent);
        }, []);

        return (
          <LegalConsentStep
            legalConsent={legalConsent}
            onLegalConsentChange={handleLegalConsentChange}
            onNext={onNext}
            onBack={vi.fn()}
          />
        );
      }

      render(<Wrapper />);

      expect(await screen.findByTestId('signup-legal-feedback')).toHaveTextContent(
        '필수 문서를 불러오지 못해 지금은 가입할 수 없어요',
      );
      expect(screen.queryByLabelText('[필수] 이용약관 동의')).not.toBeInTheDocument();
      const next = screen.getByRole('button', { name: '다음 단계' });
      expect(next).toBeDisabled();
      fireEvent.click(next);
      expect(onNext).not.toHaveBeenCalled();
      expect(latestConsent.legalAcceptances).toBeUndefined();
    },
  );

  it('가입할 수 없음 상태에서 다시 불러오기를 누르면 묶음을 다시 읽는다', async () => {
    const fetcher = vi
      .fn<() => Promise<Response>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(legalBundle), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetcher);
    renderWithState();

    fireEvent.click(await screen.findByRole('button', { name: '다시 불러오기' }));

    expect(await screen.findByLabelText('[필수] 이용약관 동의')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('signup-legal-feedback')).not.toBeInTheDocument();
  });

  // The checks belong to the versions they were given for: a failed read leaves no checks behind for whatever
  // bundle comes next, on a retry or when the step opens again with the kept consent.
  describe('묶음을 못 읽은 뒤의 필수 동의 체크', () => {
    const checkedOldConsent: LegalConsentData = {
      agreeAge: true,
      agreeTerms: true,
      agreePersonalDataCollectionUse: true,
      legalAcceptances: {
        termsVersionId: 'terms-old-id',
        personalDataConsentVersionId: 'personal-data-old-id',
        ageNoticeVersionId: 'age-old-id',
        privacyPolicyVersionIdShown: 'privacy-old-id',
      },
    };
    const newBundle = {
      termsOfService: { ...legalBundle.termsOfService, id: 'terms-new-id' },
      privacyPolicy: { ...legalBundle.privacyPolicy, id: 'privacy-new-id' },
      personalDataCollectionUseConsent: {
        ...legalBundle.personalDataCollectionUseConsent,
        id: 'personal-data-new-id',
      },
      age14OrAboveNotice: { ...legalBundle.age14OrAboveNotice, id: 'age-new-id' },
    };

    it('다시 불러온 묶음의 판 id가 바뀌었으면 체크를 다시 받는다', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn<() => Promise<Response>>()
          .mockRejectedValueOnce(new Error('offline'))
          .mockResolvedValueOnce(
            new Response(JSON.stringify(newBundle), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          ),
      );
      renderWithState({ initialLegalConsent: checkedOldConsent });

      fireEvent.click(await screen.findByRole('button', { name: '다시 불러오기' }));
      await screen.findByLabelText('[필수] 이용약관 동의');

      expect(screen.getByRole('checkbox', { name: '필수 항목 모두 동의' })).not.toBeChecked();
      expect(screen.getByLabelText('[필수] 만 14세 이상이에요')).not.toBeChecked();
      expect(screen.getByLabelText('[필수] 이용약관 동의')).not.toBeChecked();
      expect(screen.getByLabelText('[필수] 개인정보 수집·이용 동의')).not.toBeChecked();
    });

    it('단계를 다시 열 때 넘길 동의에 체크를 남기지 않는다', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new Error('offline');
        }),
      );
      let latestConsent: LegalConsentData = checkedOldConsent;

      function Wrapper() {
        const [legalConsent, setLegalConsent] = useState<LegalConsentData>(checkedOldConsent);
        const handleLegalConsentChange = useCallback((nextConsent: LegalConsentData) => {
          latestConsent = nextConsent;
          setLegalConsent(nextConsent);
        }, []);

        return (
          <LegalConsentStep
            legalConsent={legalConsent}
            onLegalConsentChange={handleLegalConsentChange}
            onNext={vi.fn()}
            onBack={vi.fn()}
          />
        );
      }

      render(<Wrapper />);
      await screen.findByRole('button', { name: '다시 불러오기' });

      expect(latestConsent).toEqual(emptyLegalConsent);
    });
  });

  it('다시 불러오기를 누르면 focus를 단계 제목으로 옮긴다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    renderWithState();

    const retry = await screen.findByRole('button', { name: '다시 불러오기' });
    retry.focus();
    fireEvent.click(retry);

    expect(screen.getByRole('heading', { name: '필수 항목 확인' })).toHaveFocus();
  });

  it('stale 안내가 전달되면 사용자에게 재확인을 요구한다', async () => {
    stubBundleFetch();
    renderWithState({
      requiresReconfirmation: true,
    });

    expect(await screen.findByTestId('signup-legal-feedback')).toHaveTextContent(
      '동의 내용이 변경됐어요',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('최신 내용을 확인하고 다시 동의해 주세요.');
  });

  it('stale 재확인 중 묶음을 못 읽으면 가입할 수 없음 안내 하나만 보인다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    renderWithState({ requiresReconfirmation: true });

    expect(await screen.findByTestId('signup-legal-feedback')).toHaveTextContent(
      '필수 문서를 불러오지 못해 지금은 가입할 수 없어요',
    );
    expect(screen.getAllByTestId('signup-legal-feedback')).toHaveLength(1);
  });
});

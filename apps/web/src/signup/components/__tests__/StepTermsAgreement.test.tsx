import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { StepTermsAgreement, type TermsData } from '../StepTermsAgreement';
import { getFallbackLegalDocumentsBundle } from '@/legal/api/legal-documents-bundle.api';

vi.mock('lucide-react', () => ({
  FileText: () => null,
  X: () => null,
}));

const legalBundle = getFallbackLegalDocumentsBundle();
const emptyTerms: TermsData = {
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
  overrides: { onNext?: () => void; notice?: string; initialTerms?: TermsData } = {},
) {
  const onNext = overrides.onNext ?? vi.fn<() => void>();
  const onBack = vi.fn<() => void>();

  function Wrapper() {
    const [terms, setTerms] = useState<TermsData>(overrides.initialTerms ?? emptyTerms);
    return (
      <StepTermsAgreement
        terms={terms}
        onTermsChange={setTerms}
        onNext={onNext}
        onBack={onBack}
        notice={overrides.notice}
      />
    );
  }

  return { ...render(<Wrapper />), onNext, onBack };
}

describe('StepTermsAgreement', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
    let latestTerms: TermsData = emptyTerms;

    function Wrapper() {
      const [terms, setTerms] = useState<TermsData>(emptyTerms);
      return (
        <StepTermsAgreement
          terms={terms}
          onTermsChange={(nextTerms) => {
            latestTerms = nextTerms;
            setTerms(nextTerms);
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
    expect(latestTerms.legalAcceptances).toEqual({
      termsVersionId: legalBundle.termsOfService.id,
      personalDataConsentVersionId: legalBundle.personalDataCollectionUseConsent.id,
      ageNoticeVersionId: legalBundle.age14OrAboveNotice.id,
      privacyPolicyVersionIdShown: legalBundle.privacyPolicy.id,
    });
    expect(latestTerms.legalBundleSource).toBe('fallback');
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

import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StepTermsAgreement, type TermsData } from '../StepTermsAgreement';

vi.mock('lucide-react', () => ({
  FileText: () => null,
  Check: () => null,
  X: () => null,
}));

vi.mock('@/components/legal/LegalContentModal', () => ({
  LegalContentModal: ({ title, onClose }: { title: string; onClose: () => void }) => (
    <div data-testid="legal-modal">
      <span>{title}</span>
      <button onClick={onClose}>닫기</button>
    </div>
  ),
}));

vi.mock('@/constants/legal', () => ({
  TERMS_CONTENT: {
    terms: { title: '이용약관', content: '약관 내용' },
    privacy: { title: '개인정보 처리방침', content: '개인정보 내용' },
  },
}));

const emptyTerms: TermsData = { agreeAge: false, agreeTerms: false, agreePrivacy: false };

function renderWithState(overrides: { onNext?: () => void } = {}) {
  const onNext = overrides.onNext ?? vi.fn<() => void>();
  const onBack = vi.fn<() => void>();

  function Wrapper() {
    const [terms, setTerms] = useState<TermsData>(emptyTerms);
    return (
      <StepTermsAgreement terms={terms} onTermsChange={setTerms} onNext={onNext} onBack={onBack} />
    );
  }

  return { ...render(<Wrapper />), onNext, onBack };
}

describe('StepTermsAgreement', () => {
  it('미동의 상태에서 다음 클릭 시 에러를 표시한다', () => {
    const { onNext } = renderWithState();

    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

    expect(screen.getByText('필수 약관에 모두 동의해주세요.')).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('전체 동의 체크 후 다음 클릭 시 onNext가 호출된다', () => {
    const { onNext } = renderWithState();

    fireEvent.click(screen.getByRole('checkbox', { name: '전체 동의' }));
    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

    expect(onNext).toHaveBeenCalled();
  });

  it('보기 버튼 클릭 시 약관 모달이 열린다', () => {
    renderWithState();

    const viewButtons = screen.getAllByRole('button', { name: '보기' });
    fireEvent.click(viewButtons[0]!);

    expect(screen.getByTestId('legal-modal')).toBeInTheDocument();
    expect(screen.getByText('이용약관')).toBeInTheDocument();
  });

  it('개별 항목을 모두 체크하면 다음으로 진행할 수 있다', () => {
    const { onNext } = renderWithState();

    fireEvent.click(screen.getByRole('checkbox', { name: /만 14세/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /이용약관/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /개인정보/ }));
    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

    expect(onNext).toHaveBeenCalled();
  });
});

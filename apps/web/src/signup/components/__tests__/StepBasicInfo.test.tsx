import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StepBasicInfo, type BasicInfoData } from '../StepBasicInfo';

vi.mock('lucide-react', () => ({
  User: () => null,
  Check: () => null,
  Eye: () => null,
  EyeOff: () => null,
}));

const emptyBasicInfo: BasicInfoData = {
  nickname: '',
  password: '',
  passwordConfirm: '',
  gender: null,
  campus: null,
};

function renderWithState(overrides: { onNext?: () => void } = {}) {
  const onNext = overrides.onNext ?? vi.fn<() => void>();
  const onBack = vi.fn<() => void>();

  function Wrapper() {
    const [basicInfo, setBasicInfo] = useState<BasicInfoData>(emptyBasicInfo);
    return (
      <StepBasicInfo
        email="test@kangwon.ac.kr"
        basicInfo={basicInfo}
        onBasicInfoChange={setBasicInfo}
        onNext={onNext}
        onBack={onBack}
      />
    );
  }

  return { ...render(<Wrapper />), onNext, onBack };
}

describe('StepBasicInfo', () => {
  it('빈 필드에서 다음 클릭 시 유효성 검사 에러를 표시한다', () => {
    const { onNext } = renderWithState();

    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

    expect(screen.getByText('캠퍼스를 선택해주세요.')).toBeInTheDocument();
    expect(screen.getByText('성별을 선택해주세요.')).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('캠퍼스와 성별 선택이 가능하다', () => {
    renderWithState();

    fireEvent.click(screen.getByRole('radio', { name: '춘천캠퍼스' }));
    fireEvent.click(screen.getByRole('radio', { name: '남성' }));

    expect(screen.getByRole('radio', { name: '춘천캠퍼스' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: '남성' })).toHaveAttribute('aria-checked', 'true');
  });

  it('모든 필드를 채우면 onNext가 호출된다', () => {
    const { onNext } = renderWithState();

    fireEvent.click(screen.getByRole('radio', { name: '춘천캠퍼스' }));
    fireEvent.click(screen.getByRole('radio', { name: '남성' }));
    fireEvent.change(screen.getByLabelText(/닉네임/), { target: { value: '테스터' } });
    fireEvent.change(screen.getAllByLabelText(/^비밀번호(?!.*확인)/)[0]!, {
      target: { value: 'Test1234' },
    });
    fireEvent.change(screen.getByLabelText(/비밀번호 확인/), { target: { value: 'Test1234' } });

    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

    expect(onNext).toHaveBeenCalled();
  });

  it('비밀번호 입력 시 PasswordRequirementList가 표시된다', () => {
    renderWithState();

    fireEvent.change(screen.getAllByLabelText(/^비밀번호(?!.*확인)/)[0]!, {
      target: { value: 'ab' },
    });

    expect(screen.getByText(/8자 이상/)).toBeInTheDocument();
  });
});

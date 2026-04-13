import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StepBasicInfo, type BasicInfoData } from '../StepBasicInfo';
import { authApi } from '@/api/auth';

vi.mock('lucide-react', () => ({
  User: () => null,
  Check: () => null,
  Eye: () => null,
  EyeOff: () => null,
}));

vi.mock('@/api/auth', () => ({
  authApi: {
    validateSignupProfile: vi.fn(),
  },
}));

const mockValidateSignupProfile = vi.mocked(authApi.validateSignupProfile);

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
  beforeEach(() => {
    mockValidateSignupProfile.mockResolvedValue({ success: true });
  });

  it('빈 필드에서 다음 클릭 시 유효성 검사 에러를 표시한다', async () => {
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

  it('모든 필드를 채우면 onNext가 호출된다', async () => {
    const { onNext } = renderWithState();

    fireEvent.click(screen.getByRole('radio', { name: '춘천캠퍼스' }));
    fireEvent.click(screen.getByRole('radio', { name: '남성' }));
    fireEvent.change(screen.getByLabelText(/닉네임/), { target: { value: '테스터' } });
    fireEvent.change(screen.getAllByLabelText(/^비밀번호(?!.*확인)/)[0]!, {
      target: { value: 'Test1234' },
    });
    fireEvent.change(screen.getByLabelText(/비밀번호 확인/), { target: { value: 'Test1234' } });

    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

    await waitFor(() => {
      expect(onNext).toHaveBeenCalled();
    });
  });

  it('백엔드 닉네임 정책 오류를 즉시 표시한다', async () => {
    mockValidateSignupProfile.mockResolvedValue({
      success: false,
      error: '입력값을 다시 확인해주세요.',
      fieldErrors: { nickname: '사용할 수 없는 표현이 포함되어 있습니다.' },
    });

    const { onNext } = renderWithState();

    fireEvent.click(screen.getByRole('radio', { name: '춘천캠퍼스' }));
    fireEvent.click(screen.getByRole('radio', { name: '남성' }));
    fireEvent.change(screen.getByLabelText(/닉네임/), { target: { value: '섹스' } });
    fireEvent.change(screen.getAllByLabelText(/^비밀번호(?!.*확인)/)[0]!, {
      target: { value: 'Test1234' },
    });
    fireEvent.change(screen.getByLabelText(/비밀번호 확인/), { target: { value: 'Test1234' } });

    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

    await waitFor(() => {
      expect(screen.getByText('사용할 수 없는 표현이 포함되어 있습니다.')).toBeInTheDocument();
    });
    expect(onNext).not.toHaveBeenCalled();
  });

  it('닉네임만 입력한 상태에서 서버 금지어 오류가 있으면 닉네임에 우선 포커스한다', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    mockValidateSignupProfile.mockResolvedValue({
      success: false,
      error: '입력값을 다시 확인해주세요.',
      fieldErrors: {
        nickname: '사용할 수 없는 표현이 포함되어 있습니다.',
        password: '비밀번호를 입력해주세요.',
      },
    });

    renderWithState();

    fireEvent.change(screen.getByLabelText(/닉네임/), { target: { value: '섹스' } });
    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

    await waitFor(() => {
      expect(screen.getByText('사용할 수 없는 표현이 포함되어 있습니다.')).toBeInTheDocument();
    });
    expect(document.activeElement).toBe(screen.getByLabelText(/닉네임/));
  });

  it('비밀번호 입력 시 PasswordRequirementList가 표시된다', () => {
    renderWithState();

    fireEvent.change(screen.getAllByLabelText(/^비밀번호(?!.*확인)/)[0]!, {
      target: { value: 'ab' },
    });

    expect(screen.getByText(/8자 이상/)).toBeInTheDocument();
  });
});

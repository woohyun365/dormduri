import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '@/auth/api';
import type { SignupAccountData } from '../../model/signup-account.types';
import { AccountCredentialsStep } from '../AccountCredentialsStep';

vi.mock('lucide-react', () => ({
  KeyRound: () => null,
  CheckCircle2: () => null,
  Eye: () => null,
  EyeOff: () => null,
  Check: () => null,
  AlertCircle: () => null,
  CheckCircle: () => null,
  Info: () => null,
  Timer: () => null,
  WifiOff: () => null,
}));

vi.mock('@/auth/api', () => ({
  authApi: {
    validateSignupDraft: vi.fn(),
  },
}));

const mockValidateSignupDraft = vi.mocked(authApi.validateSignupDraft);

const emptyAccountData: SignupAccountData = {
  nickname: '',
  password: '',
  passwordConfirm: '',
  gender: null,
  campus: null,
  collegeCode: null,
  birthYear: null,
};

function renderWithState(overrides: { onNext?: (data: SignupAccountData) => void } = {}) {
  const onNext = overrides.onNext ?? vi.fn<(data: SignupAccountData) => void>();
  const onBack = vi.fn<() => void>();

  function Wrapper() {
    const [accountData, setAccountData] = useState<SignupAccountData>(emptyAccountData);
    return (
      <AccountCredentialsStep
        email="test@kangwon.ac.kr"
        accountData={accountData}
        onAccountDataChange={setAccountData}
        onNext={onNext}
        onBack={onBack}
      />
    );
  }

  return { ...render(<Wrapper />), onNext, onBack };
}

function fillValidCredentials() {
  fireEvent.change(screen.getByLabelText(/닉네임/), { target: { value: '  테스터  ' } });
  fireEvent.change(screen.getAllByLabelText(/^비밀번호(?!.*확인)/)[0]!, {
    target: { value: 'Test1234' },
  });
  fireEvent.change(screen.getByLabelText(/비밀번호 확인/), {
    target: { value: 'Test1234' },
  });
}

describe('AccountCredentialsStep', () => {
  beforeEach(() => {
    mockValidateSignupDraft.mockReset();
    mockValidateSignupDraft.mockResolvedValue({ success: true });
  });

  it('닉네임과 비밀번호를 입력하지 않으면 다음 단계로 이동하지 않는다', async () => {
    const { onNext } = renderWithState();

    fireEvent.click(screen.getByRole('button', { name: '계속하기' }));

    expect(await screen.findByText('닉네임을 입력해주세요.')).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
    expect(mockValidateSignupDraft).not.toHaveBeenCalled();
  });

  it('로그인 정보를 검증하고 정리한 닉네임으로 다음 단계에 전달한다', async () => {
    const { onNext } = renderWithState();
    fillValidCredentials();

    fireEvent.click(screen.getByRole('button', { name: '계속하기' }));

    await waitFor(() => {
      expect(mockValidateSignupDraft).toHaveBeenCalledWith({
        email: 'test@kangwon.ac.kr',
        nickname: '테스터',
        password: 'Test1234',
      });
      expect(onNext).toHaveBeenCalledWith(
        expect.objectContaining({
          nickname: '테스터',
          password: 'Test1234',
        }),
      );
    });
  });

  it('한글과 영문을 섞으면 API를 호출하기 전에 안내한다', async () => {
    const { onNext } = renderWithState();
    fireEvent.change(screen.getByLabelText(/닉네임/), { target: { value: '안녕hi' } });
    fireEvent.click(screen.getByRole('button', { name: '계속하기' }));

    expect(await screen.findByText('한글과 영문은 함께 사용할 수 없어요.')).toBeInTheDocument();
    expect(mockValidateSignupDraft).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('백엔드 닉네임 정책 오류를 입력 필드에 표시한다', async () => {
    mockValidateSignupDraft.mockResolvedValue({
      success: false,
      error: '입력값을 다시 확인해주세요.',
      fieldErrors: { nickname: '닉네임에 사용할 수 없는 단어가 포함되어 있어요.' },
    });
    const { onNext } = renderWithState();
    fillValidCredentials();

    fireEvent.click(screen.getByRole('button', { name: '계속하기' }));

    expect(
      await screen.findByText('닉네임에 사용할 수 없는 단어가 포함되어 있어요.'),
    ).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('로그인 정보 확인 요청이 실패하면 입력값을 유지하고 다시 시도할 수 있다', async () => {
    mockValidateSignupDraft.mockRejectedValueOnce(new Error('network unavailable'));
    const { onNext } = renderWithState();
    fillValidCredentials();

    fireEvent.click(screen.getByRole('button', { name: '계속하기' }));

    expect(await screen.findByText('입력 내용을 확인하지 못했어요')).toBeInTheDocument();
    expect(screen.getByDisplayValue('테스터')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '계속하기' })).toBeEnabled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('확인 중이거나 비활성 상태에서는 CTA를 비활성화한다', () => {
    render(
      <AccountCredentialsStep
        email="test@kangwon.ac.kr"
        accountData={emptyAccountData}
        onAccountDataChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
        disabled
      />,
    );

    expect(screen.getByRole('button', { name: '계속하기' })).toBeDisabled();
  });

  it('비밀번호 입력 중 요구사항을 함께 표시한다', () => {
    renderWithState();

    fireEvent.change(screen.getAllByLabelText(/^비밀번호(?!.*확인)/)[0]!, {
      target: { value: 'ab' },
    });

    expect(screen.getByText(/8자 이상/)).toBeInTheDocument();
  });
});

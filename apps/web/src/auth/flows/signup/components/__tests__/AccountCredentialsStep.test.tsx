import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '@/auth/api';
import type { SignupAccountData } from '../../model/signup-account.types';
import { AccountCredentialsStep } from '../AccountCredentialsStep';

vi.mock('lucide-react', () => ({
  KeyRound: () => null,
  CheckCircle2: () => null,
  Circle: () => null,
  CircleCheck: () => null,
  CircleX: () => null,
  Eye: () => null,
  EyeOff: () => null,
  Check: () => null,
  AlertCircle: () => null,
  CheckCircle: () => null,
  Info: () => null,
  LoaderCircle: () => null,
  RotateCcw: () => null,
  Timer: () => null,
  WifiOff: () => null,
}));

vi.mock('@/auth/api', () => ({
  authApi: {
    validateSignupNickname: vi.fn(),
  },
}));

const mockValidateSignupNickname = vi.mocked(authApi.validateSignupNickname);

const emptyAccountData: SignupAccountData = {
  nickname: '',
  password: '',
  passwordConfirm: '',
  gender: null,
  campus: null,
  collegeCode: null,
  birthYear: null,
};

function renderWithState(
  overrides: {
    onNext?: (data: SignupAccountData) => void;
    initialAccountData?: SignupAccountData;
    serverFieldErrors?: { nickname?: string; password?: string };
    onEmailProofExpired?: () => void;
    email?: string;
  } = {},
) {
  const onNext = overrides.onNext ?? vi.fn<(data: SignupAccountData) => void>();
  const onBack = vi.fn<() => void>();

  function Wrapper() {
    const [accountData, setAccountData] = useState<SignupAccountData>(
      overrides.initialAccountData ?? emptyAccountData,
    );
    return (
      <AccountCredentialsStep
        email={overrides.email ?? 'test@kangwon.ac.kr'}
        accountData={accountData}
        onAccountDataChange={setAccountData}
        onNext={onNext}
        onBack={onBack}
        serverFieldErrors={overrides.serverFieldErrors}
        onEmailProofExpired={overrides.onEmailProofExpired}
      />
    );
  }

  return { ...render(<Wrapper />), onNext, onBack };
}

function fillValidCredentials() {
  fireEvent.change(screen.getByLabelText(/닉네임/), { target: { value: '  테스터  ' } });
  fireEvent.change(screen.getAllByLabelText(/^비밀번호(?!.*확인)/)[0]!, {
    target: { value: 'Test123456' },
  });
  fireEvent.change(screen.getByLabelText(/비밀번호 확인/), {
    target: { value: 'Test123456' },
  });
}

describe('AccountCredentialsStep', () => {
  beforeEach(() => {
    mockValidateSignupNickname.mockReset();
    mockValidateSignupNickname.mockResolvedValue({ success: true, nickname: '테스터' });
  });

  it('닉네임과 비밀번호를 입력하지 않으면 다음 단계로 이동하지 않는다', async () => {
    const { onNext } = renderWithState();

    fireEvent.click(screen.getByRole('button', { name: '중복 확인' }));

    expect(await screen.findByText('닉네임을 입력해주세요.')).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
    expect(mockValidateSignupNickname).not.toHaveBeenCalled();
  });

  it('로그인 정보를 검증하고 정리한 닉네임으로 다음 단계에 전달한다', async () => {
    const { onNext } = renderWithState();
    fillValidCredentials();

    fireEvent.click(screen.getByRole('button', { name: '중복 확인' }));

    await waitFor(() => {
      expect(mockValidateSignupNickname).toHaveBeenCalledWith(
        { nickname: '테스터' },
        expect.any(AbortSignal),
      );
      expect(screen.getByRole('button', { name: '계속하기' })).toBeEnabled();
    });
    expect(screen.getByText('사용할 수 있는 닉네임이에요.')).toHaveClass('text-sm', 'leading-5');

    fireEvent.click(screen.getByRole('button', { name: '계속하기' }));

    await waitFor(() => {
      expect(onNext).toHaveBeenCalledWith(
        expect.objectContaining({
          nickname: '테스터',
          password: 'Test123456',
        }),
      );
    });
    expect(mockValidateSignupNickname).toHaveBeenCalledTimes(1);
  });

  it('닉네임 중복 확인이 완료되기 전에는 다음 단계로 이동할 수 없다', async () => {
    const { onNext } = renderWithState();
    fillValidCredentials();

    expect(screen.getByRole('button', { name: '계속하기' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '중복 확인' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: '중복 확인' }));

    await waitFor(() => {
      expect(mockValidateSignupNickname).toHaveBeenCalledWith(
        { nickname: '테스터' },
        expect.any(AbortSignal),
      );
      expect(screen.getByRole('button', { name: '계속하기' })).toBeEnabled();
    });
    expect(onNext).not.toHaveBeenCalled();
  });

  it('확인된 닉네임을 수정하면 이전 확인 결과를 즉시 무효화한다', async () => {
    renderWithState();
    fillValidCredentials();

    fireEvent.click(screen.getByRole('button', { name: '중복 확인' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '계속하기' })).toBeEnabled();
    });

    fireEvent.change(screen.getByLabelText(/닉네임/), { target: { value: '새닉네임' } });

    expect(screen.getByRole('button', { name: '계속하기' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '중복 확인' })).toBeEnabled();
    expect(screen.getByText('닉네임을 수정했어요. 다시 확인해 주세요.')).toBeInTheDocument();
  });

  it('최종 가입 중 선점된 닉네임은 입력을 보존하고 해당 필드로 복구한다', async () => {
    renderWithState({
      initialAccountData: {
        ...emptyAccountData,
        nickname: '감자친구',
        password: 'Test123456',
        passwordConfirm: 'Test123456',
      },
      serverFieldErrors: { nickname: '이미 사용 중인 닉네임이에요.' },
    });

    const nicknameInput = screen.getByRole('textbox', { name: /닉네임/ });
    expect(nicknameInput).toHaveValue('감자친구');
    expect(await screen.findByText('이미 사용 중인 닉네임이에요.')).toBeInTheDocument();
    await waitFor(() => expect(nicknameInput).toHaveFocus());
    expect(screen.getByRole('button', { name: '계속하기' })).toBeDisabled();
  });

  it('API-private 비밀번호 정책 거절은 generic field feedback으로 표시한다', async () => {
    renderWithState({
      initialAccountData: {
        ...emptyAccountData,
        nickname: '감자친구',
        password: 'Password1!',
        passwordConfirm: 'Password1!',
      },
      serverFieldErrors: {
        password: '다른 비밀번호를 입력해 주세요.',
      },
    });

    const passwordInput = screen.getAllByLabelText(/비밀번호/, { selector: 'input' })[0]!;
    expect(passwordInput).toHaveValue('Password1!');
    expect(await screen.findByText('다른 비밀번호를 입력해 주세요.')).toBeInTheDocument();
    await waitFor(() => expect(passwordInput).toHaveFocus());
  });

  it('학교 이메일 로컬파트를 비밀번호로 사용하면 다음 단계로 이동하지 않는다', async () => {
    const { onNext } = renderWithState({
      email: 'knuStudent@kangwon.ac.kr',
      initialAccountData: {
        ...emptyAccountData,
        nickname: '감자친구',
        password: 'knuStudent',
        passwordConfirm: 'knuStudent',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: '중복 확인' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '계속하기' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '계속하기' }));

    expect(
      await screen.findByText('이메일 정보와 다른 비밀번호를 입력해 주세요.'),
    ).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('한글과 영문을 섞으면 API를 호출하기 전에 안내한다', async () => {
    const { onNext } = renderWithState();
    fireEvent.change(screen.getByLabelText(/닉네임/), { target: { value: '안녕hi' } });
    fireEvent.click(screen.getByRole('button', { name: '중복 확인' }));

    expect(await screen.findByText('한글과 영문은 함께 사용할 수 없어요.')).toBeInTheDocument();
    expect(mockValidateSignupNickname).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('백엔드 닉네임 정책 오류를 입력 필드에 표시한다', async () => {
    mockValidateSignupNickname.mockResolvedValue({
      success: false,
      code: 'AUTH_SIGNUP_NICKNAME_NOT_ALLOWED',
      error: '입력값을 다시 확인해주세요.',
      userActionable: true,
      fieldErrors: { nickname: '닉네임에 사용할 수 없는 단어가 포함되어 있어요.' },
    });
    const { onNext } = renderWithState();
    fillValidCredentials();

    fireEvent.click(screen.getByRole('button', { name: '중복 확인' }));

    expect(
      await screen.findByText('닉네임에 사용할 수 없는 단어가 포함되어 있어요.'),
    ).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('로그인 정보 확인 요청이 실패하면 입력값을 유지하고 다시 시도할 수 있다', async () => {
    mockValidateSignupNickname.mockRejectedValueOnce(new Error('network unavailable'));
    const { onNext } = renderWithState();
    fillValidCredentials();

    fireEvent.click(screen.getByRole('button', { name: '중복 확인' }));

    expect(await screen.findByText('닉네임을 확인하지 못했어요')).toBeInTheDocument();
    expect(await screen.findByText('네트워크를 확인한 뒤 다시 시도해 주세요.')).toBeInTheDocument();
    expect(screen.getByTestId('signup-nickname-action-feedback')).toHaveAttribute(
      'data-variant',
      'connectivity',
    );
    expect(screen.getByDisplayValue('테스터')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '계속하기' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '중복 확인' })).toBeEnabled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('닉네임 확인 중 signup 인증이 만료되면 다시 인증하도록 안내한다', async () => {
    mockValidateSignupNickname.mockResolvedValueOnce({
      success: false,
      code: 'AUTH_SIGNUP_EMAIL_VERIFICATION_REQUIRED',
      error: '학교 이메일 인증이 필요합니다.',
      userActionable: true,
    });
    const onEmailProofExpired = vi.fn();
    renderWithState({ onEmailProofExpired });
    fillValidCredentials();

    fireEvent.click(screen.getByRole('button', { name: '중복 확인' }));

    expect(await screen.findByText('학교 이메일 인증이 만료됐어요')).toBeInTheDocument();
    expect(screen.getByText('학교 이메일을 다시 인증해 주세요.')).toBeInTheDocument();
    expect(screen.getByTestId('signup-nickname-action-feedback')).toHaveAttribute(
      'data-variant',
      'warning',
    );
    expect(onEmailProofExpired).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '계속하기' })).toBeDisabled();
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
    expect(screen.getByRole('button', { name: '중복 확인' })).toBeDisabled();
  });

  it('입력 변경 뒤 늦게 도착한 이전 응답은 현재 닉네임을 승인하지 않는다', async () => {
    let resolveRequest: ((value: { success: true; nickname: string }) => void) | undefined;
    mockValidateSignupNickname.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    renderWithState();
    fillValidCredentials();

    fireEvent.click(screen.getByRole('button', { name: '중복 확인' }));
    expect(screen.getByRole('button', { name: '확인 중...' })).toBeDisabled();
    expect(screen.getByText('닉네임을 확인하고 있어요.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/닉네임/), { target: { value: '새닉네임' } });
    resolveRequest?.({ success: true, nickname: '테스터' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '계속하기' })).toBeDisabled();
    });
    expect(screen.queryByText('사용할 수 있는 닉네임이에요.')).not.toBeInTheDocument();
  });

  it('닉네임 입력에서 Enter를 누르면 확인 action을 실행한다', async () => {
    renderWithState();
    fireEvent.change(screen.getByLabelText(/닉네임/), { target: { value: '테스터' } });

    fireEvent.keyDown(screen.getByLabelText(/닉네임/), { key: 'Enter' });

    await waitFor(() => {
      expect(mockValidateSignupNickname).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByLabelText(/닉네임/)).toHaveAttribute('aria-describedby');
  });

  it('비밀번호 입력 중 요구사항을 함께 표시한다', () => {
    renderWithState();

    fireEvent.change(screen.getAllByLabelText(/^비밀번호(?!.*확인)/)[0]!, {
      target: { value: 'ab' },
    });

    expect(screen.getByText(/10~128자/)).toBeInTheDocument();
    expect(screen.queryByText(/영문 포함|숫자 포함/)).not.toBeInTheDocument();
  });
});

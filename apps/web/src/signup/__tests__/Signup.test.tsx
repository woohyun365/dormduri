import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Signup from '../Signup';
import { authApi } from '@/api/auth';

const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('lucide-react', () => ({
  AlertCircle: () => <span data-testid="icon-alert" />,
  ChevronLeft: () => <span data-testid="icon-back" />,
}));

vi.mock('@/hooks/useRedirectIfAuthenticated', () => ({
  useRedirectIfAuthenticated: vi.fn(() => ({ isReadyToRender: true })),
}));

vi.mock('@/api/auth', () => ({
  authApi: { signup: vi.fn() },
}));

// --- Step component mocks (wizard shell 테스트용) ---

vi.mock('../components/email-verification/StepEmailVerification', () => ({
  StepEmailVerification: ({
    onNext,
    onVerified,
  }: {
    onNext: () => void;
    onVerified: () => void;
  }) => (
    <button
      data-testid="step-1-next"
      onClick={() => {
        onVerified();
        onNext();
      }}
    >
      next
    </button>
  ),
}));

vi.mock('../components/StepTermsAgreement', () => ({
  StepTermsAgreement: ({ onNext }: { onNext: () => void }) => (
    <button data-testid="step-2-next" onClick={onNext}>
      next
    </button>
  ),
}));

vi.mock('../components/StepBasicInfo', () => ({
  StepBasicInfo: ({
    onNext,
    onBasicInfoChange,
  }: {
    onNext: () => void;
    onBasicInfoChange: (data: Record<string, unknown>) => void;
  }) => (
    <button
      data-testid="step-3-next"
      onClick={() => {
        onBasicInfoChange({
          nickname: 'tester',
          password: 'Test1234',
          passwordConfirm: 'Test1234',
          gender: 'M',
          campus: 'CHUNCHEON',
        });
        onNext();
      }}
    >
      next
    </button>
  ),
}));

vi.mock('../components/StepSleepPattern', () => ({
  StepSleepPattern: ({ onNext }: { onNext: () => void }) => (
    <button data-testid="step-4-next" onClick={onNext}>
      next
    </button>
  ),
}));

vi.mock('../components/StepLivingPattern', () => ({
  StepLivingPattern: ({ onNext }: { onNext: () => void }) => (
    <button data-testid="step-5-next" onClick={onNext}>
      next
    </button>
  ),
}));

vi.mock('../components/StepRoommateConditions', () => ({
  StepRoommateConditions: ({ onNext }: { onNext: () => void }) => (
    <button data-testid="step-6-next" onClick={onNext}>
      submit
    </button>
  ),
}));

vi.mock('../components/StepComplete', () => ({
  StepComplete: () => <div data-testid="step-complete">가입 완료</div>,
}));

vi.mock('@/components/AuthHeader', () => ({
  AuthHeader: ({ onLogoClick }: { onLogoClick?: () => boolean }) => (
    <button data-testid="logo" onClick={() => onLogoClick?.()}>
      Logo
    </button>
  ),
}));

const mockSignup = vi.mocked(authApi.signup);

function advanceToStep(step: number) {
  if (step >= 2) fireEvent.click(screen.getByTestId('step-1-next'));
  if (step >= 3) fireEvent.click(screen.getByTestId('step-2-next'));
  if (step >= 4) fireEvent.click(screen.getByTestId('step-3-next'));
  if (step >= 5) fireEvent.click(screen.getByTestId('step-4-next'));
  if (step >= 6) fireEvent.click(screen.getByTestId('step-5-next'));
}

describe('Signup', () => {
  beforeEach(() => {
    mockSignup.mockResolvedValue({ success: true });
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockReplace.mockClear();
  });

  it('Step 1(이메일 인증)부터 시작한다', () => {
    render(<Signup />);

    expect(screen.getByTestId('step-1-next')).toBeInTheDocument();
  });

  it('모든 단계를 순서대로 진행하여 가입을 완료할 수 있다', async () => {
    render(<Signup />);

    advanceToStep(6);
    expect(screen.getByTestId('step-6-next')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('step-6-next'));
    });

    expect(mockSignup).toHaveBeenCalled();
    expect(screen.getByTestId('step-complete')).toBeInTheDocument();
  });

  it('진행 중 로고 클릭 시 이탈 확인 다이얼로그를 표시한다', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<Signup />);

    // Step 1 완료 → step 2 (isEmailVerified = true)
    fireEvent.click(screen.getByTestId('step-1-next'));

    fireEvent.click(screen.getByTestId('logo'));

    expect(confirmSpy).toHaveBeenCalledWith('입력한 내용이 모두 사라집니다. 나가시겠습니까?');
  });

  it('회원가입 실패 시 에러 메시지와 재시도 버튼을 표시한다', async () => {
    mockSignup.mockResolvedValue({
      success: false,
      error: '이미 가입된 이메일입니다.',
    });

    render(<Signup />);
    advanceToStep(6);

    await act(async () => {
      fireEvent.click(screen.getByTestId('step-6-next'));
    });

    expect(screen.getByText('이미 가입된 이메일입니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });

  it('네트워크 오류 시 에러 메시지를 표시한다', async () => {
    mockSignup.mockRejectedValue(new Error('Network error'));

    render(<Signup />);
    advanceToStep(6);

    await act(async () => {
      fireEvent.click(screen.getByTestId('step-6-next'));
    });

    expect(
      screen.getByText('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'),
    ).toBeInTheDocument();
  });
});

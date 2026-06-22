import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
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
    onEmailChange,
    isVerified,
  }: {
    onNext: () => void;
    onVerified: () => void;
    onEmailChange: (email: string) => void;
    isVerified: boolean;
  }) => (
    <div>
      <button
        data-testid="step-1-verify"
        onClick={() => {
          onEmailChange('test@kangwon.ac.kr');
          onVerified();
        }}
      >
        verify
      </button>
      {isVerified && (
        <button data-testid="step-1-next" onClick={onNext}>
          next
        </button>
      )}
    </div>
  ),
}));

vi.mock('../components/StepTermsAgreement', () => ({
  StepTermsAgreement: ({
    onNext,
    onTermsChange,
    notice,
  }: {
    onNext: () => void;
    onTermsChange: (terms: Record<string, unknown>) => void;
    notice?: string;
  }) => (
    <div>
      {notice && <p role="status">{notice}</p>}
      <button
        data-testid="step-2-next"
        onClick={() => {
          const legalAcceptances = notice
            ? {
                termsVersionId: 'terms-of-service-2026-06-23',
                personalDataConsentVersionId: 'personal-data-collection-use-consent-2026-06-23',
                ageNoticeVersionId: 'age-14-or-above-notice-2026-06-23',
                privacyPolicyVersionIdShown: 'privacy-policy-2026-06-23',
              }
            : {
                termsVersionId: 'terms-of-service-2026-06-22',
                personalDataConsentVersionId: 'personal-data-collection-use-consent-2026-06-22',
                ageNoticeVersionId: 'age-14-or-above-notice-2026-06-22',
                privacyPolicyVersionIdShown: 'privacy-policy-2026-06-22',
              };
          onTermsChange({
            agreeAge: true,
            agreeTerms: true,
            agreePersonalDataCollectionUse: true,
            legalAcceptances,
            legalBundleSource: 'api',
          });
          onNext();
        }}
      >
        next
      </button>
    </div>
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
  StepComplete: ({ onGoToHome }: { onGoToHome: () => void }) => (
    <button data-testid="step-complete" onClick={onGoToHome}>
      가입 완료
    </button>
  ),
}));

vi.mock('@/components/AuthHeader', () => ({
  AuthHeader: ({ onLogoClick }: { onLogoClick?: () => boolean }) => (
    <button data-testid="logo" onClick={() => onLogoClick?.()}>
      Logo
    </button>
  ),
}));

const mockSignup = vi.mocked(authApi.signup);

const SIGNUP_LEGAL_ACCEPTANCES = {
  termsVersionId: 'terms-of-service-2026-06-22',
  personalDataConsentVersionId: 'personal-data-collection-use-consent-2026-06-22',
  ageNoticeVersionId: 'age-14-or-above-notice-2026-06-22',
  privacyPolicyVersionIdShown: 'privacy-policy-2026-06-22',
};

const REFRESHED_SIGNUP_LEGAL_ACCEPTANCES = {
  termsVersionId: 'terms-of-service-2026-06-23',
  personalDataConsentVersionId: 'personal-data-collection-use-consent-2026-06-23',
  ageNoticeVersionId: 'age-14-or-above-notice-2026-06-23',
  privacyPolicyVersionIdShown: 'privacy-policy-2026-06-23',
};

function advanceToStep(step: number) {
  if (step >= 2) {
    fireEvent.click(screen.getByTestId('step-1-verify'));
    fireEvent.click(screen.getByTestId('step-1-next'));
  }
  if (step >= 3) fireEvent.click(screen.getByTestId('step-2-next'));
  if (step >= 4) fireEvent.click(screen.getByTestId('step-3-next'));
  if (step >= 5) fireEvent.click(screen.getByTestId('step-4-next'));
  if (step >= 6) fireEvent.click(screen.getByTestId('step-5-next'));
}

describe('Signup', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockSignup.mockReset();
    mockSignup.mockResolvedValue({ success: true });
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockReplace.mockClear();
  });

  it('Step 1(이메일 인증)부터 시작한다', () => {
    render(<Signup />);

    expect(screen.getByTestId('step-1-verify')).toBeInTheDocument();
  });

  it('모든 단계를 순서대로 진행하여 가입을 완료할 수 있다', async () => {
    render(<Signup />);

    advanceToStep(6);
    expect(screen.getByTestId('step-6-next')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('step-6-next'));
    });

    expect(mockSignup).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@kangwon.ac.kr',
        password: 'Test1234',
        nickname: 'tester',
        gender: 'M',
        campus: 'CHUNCHEON',
        legalAcceptances: SIGNUP_LEGAL_ACCEPTANCES,
      }),
    );
    const completeButton = screen.getByTestId('step-complete');
    expect(completeButton).toBeInTheDocument();

    fireEvent.click(completeButton);
    expect(mockReplace).toHaveBeenCalledWith('/main');
  });

  it('진행 중 로고 클릭 시 이탈 확인 다이얼로그를 표시한다', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<Signup />);

    // Step 1 완료 → step 2 (isEmailVerified = true)
    fireEvent.click(screen.getByTestId('step-1-verify'));
    fireEvent.click(screen.getByTestId('step-1-next'));

    fireEvent.click(screen.getByTestId('logo'));

    expect(confirmSpy).toHaveBeenCalledWith('입력한 내용이 모두 사라집니다. 나가시겠습니까?');
  });

  it('legal acceptance stale 실패 시 약관 단계로 되돌리고 재확인을 요구한다', async () => {
    mockSignup.mockResolvedValueOnce({
      success: false,
      code: 'AUTH_LEGAL_ACCEPTANCE_STALE',
      error: '약관 또는 개인정보 동의 내용이 변경되었습니다.',
    });

    render(<Signup />);
    advanceToStep(6);

    await act(async () => {
      fireEvent.click(screen.getByTestId('step-6-next'));
    });

    expect(screen.getByTestId('step-2-next')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('최신 내용을 다시 확인');
    expect(mockSignup).toHaveBeenCalled();
  });

  it('legal acceptance stale 이후 재시도할 때 이전 legal ids를 재사용하지 않는다', async () => {
    mockSignup
      .mockResolvedValueOnce({
        success: false,
        code: 'AUTH_LEGAL_ACCEPTANCE_STALE',
        error: '약관 또는 개인정보 동의 내용이 변경되었습니다.',
      })
      .mockResolvedValueOnce({ success: true });

    render(<Signup />);
    advanceToStep(6);

    await act(async () => {
      fireEvent.click(screen.getByTestId('step-6-next'));
    });

    expect(screen.getByRole('status')).toHaveTextContent('최신 내용을 다시 확인');

    await act(async () => {
      fireEvent.click(screen.getByTestId('step-2-next'));
    });
    await waitFor(() => {
      expect(sessionStorage.getItem('signup-draft')).toContain('terms-of-service-2026-06-23');
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('step-3-next'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('step-4-next'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('step-5-next'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('step-6-next'));
    });

    expect(mockSignup).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        legalAcceptances: SIGNUP_LEGAL_ACCEPTANCES,
      }),
    );
    expect(mockSignup).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        legalAcceptances: REFRESHED_SIGNUP_LEGAL_ACCEPTANCES,
      }),
    );
    expect(screen.getByTestId('step-complete')).toBeInTheDocument();
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

  it('이메일 인증 만료 에러가 나면 카드에 포커스하고 다시 인증 흐름으로 복귀시킨다', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    mockSignup.mockResolvedValueOnce({
      success: false,
      error: '이메일 인증을 먼저 완료해주세요.',
    });

    render(<Signup />);
    advanceToStep(6);

    await act(async () => {
      fireEvent.click(screen.getByTestId('step-6-next'));
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('이메일 인증을 먼저 완료해주세요.');
    expect(document.activeElement).toBe(alert);
    expect(screen.getByRole('button', { name: '이메일 다시 인증하기' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '이메일 다시 인증하기' }));
    expect(screen.getByTestId('step-1-verify')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('step-1-verify'));
    expect(screen.getByTestId('step-6-next')).toBeInTheDocument();
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

  describe('sessionStorage persist/restore', () => {
    it('Step 4 이상에서 새로고침하면 비밀번호가 없으므로 Step 3으로 복원된다', () => {
      sessionStorage.setItem(
        'signup-draft',
        JSON.stringify({
          currentStep: 5,
          email: 'test@kangwon.ac.kr',
          isEmailVerified: true,
          terms: {
            agreeAge: true,
            agreeTerms: true,
            agreePersonalDataCollectionUse: true,
            legalAcceptances: SIGNUP_LEGAL_ACCEPTANCES,
          },
          nickname: 'tester',
          gender: 'M',
          campus: 'CHUNCHEON',
          intro: '',
          lifestyle: {},
        }),
      );

      render(<Signup />);

      // Step 3으로 복원 (비밀번호 미저장 → fallback)
      expect(screen.getByTestId('step-3-next')).toBeInTheDocument();
    });

    it('Step 3 이하에서 새로고침하면 해당 Step으로 복원된다', () => {
      sessionStorage.setItem(
        'signup-draft',
        JSON.stringify({
          currentStep: 2,
          email: 'test@kangwon.ac.kr',
          isEmailVerified: true,
          terms: { agreeAge: false, agreeTerms: false, agreePersonalDataCollectionUse: false },
          nickname: '',
          gender: null,
          campus: null,
          intro: '',
          lifestyle: {},
        }),
      );

      render(<Signup />);

      expect(screen.getByTestId('step-2-next')).toBeInTheDocument();
    });

    it('약관 단계 draft에는 legal ids만 저장하고 문서 본문은 저장하지 않는다', async () => {
      render(<Signup />);

      advanceToStep(3);

      await waitFor(() => {
        const rawDraft = sessionStorage.getItem('signup-draft');
        expect(rawDraft).not.toBeNull();
        expect(rawDraft).toContain('legalAcceptances');
        expect(rawDraft).toContain('privacyPolicyVersionIdShown');
        expect(rawDraft).not.toContain('summaryItems');
        expect(rawDraft).not.toContain('sections');
        expect(rawDraft).not.toContain('KNU 룸메 개인정보 처리방침');
      });
    });

    it('회원가입 완료(Step 7) 시 sessionStorage가 삭제된다', async () => {
      render(<Signup />);

      advanceToStep(6);
      await act(async () => {
        fireEvent.click(screen.getByTestId('step-6-next'));
      });

      expect(screen.getByTestId('step-complete')).toBeInTheDocument();
      expect(sessionStorage.getItem('signup-draft')).toBeNull();
    });

    it('로고 클릭 이탈 시 sessionStorage가 삭제된다', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      render(<Signup />);

      // Step 2까지 진행 (draft 생성)
      fireEvent.click(screen.getByTestId('step-1-verify'));
      fireEvent.click(screen.getByTestId('step-1-next'));
      expect(sessionStorage.getItem('signup-draft')).not.toBeNull();

      // 로고 클릭 이탈 확인
      fireEvent.click(screen.getByTestId('logo'));

      expect(sessionStorage.getItem('signup-draft')).toBeNull();
    });
  });
});

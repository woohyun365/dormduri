import React from 'react';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SignupPageClient from '../SignupPageClient';
import { authApi } from '@/auth/api';
import { useRedirectIfAuthenticated } from '@/hooks/useRedirectIfAuthenticated';

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

vi.mock('@/auth/api', () => ({
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

vi.mock('../components/LegalConsentStep', () => ({
  LegalConsentStep: ({
    onNext,
    onLegalConsentChange,
    notice,
  }: {
    onNext: () => void;
    onLegalConsentChange: (legalConsent: Record<string, unknown>) => void;
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
          onLegalConsentChange({
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

vi.mock('../components/AccountIdentityStep', () => ({
  AccountIdentityStep: ({
    onNext,
    onBasicInfoChange,
  }: {
    onNext: (data: Record<string, unknown>) => void | Promise<void>;
    onBasicInfoChange: (data: Record<string, unknown>) => void;
  }) => (
    <button
      data-testid="step-3-next"
      onClick={() => {
        const accountIdentityFixture = {
          nickname: 'tester',
          password: 'Test1234',
          passwordConfirm: 'Test1234',
          gender: 'M',
          campus: 'CHUNCHEON',
          collegeCode: 'IT',
          birthYear: VALID_SIGNUP_BIRTH_YEAR,
        };
        onBasicInfoChange(accountIdentityFixture);
        void onNext(accountIdentityFixture);
      }}
    >
      가입하기
    </button>
  ),
}));

vi.mock('../components/SignupCompleteStep', () => ({
  SignupCompleteStep: ({ onGoToHome }: { onGoToHome: () => void }) => (
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
const mockUseRedirectIfAuthenticated = vi.mocked(useRedirectIfAuthenticated);
const VALID_SIGNUP_BIRTH_YEAR = new Date().getFullYear() - 24;

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
}

async function submitAccountIdentity() {
  await act(async () => {
    fireEvent.click(screen.getByTestId('step-3-next'));
  });
}

describe('SignupPageClient', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockSignup.mockReset();
    mockSignup.mockResolvedValue({ success: true });
    mockUseRedirectIfAuthenticated.mockReturnValue({ isReadyToRender: true });
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockReplace.mockClear();
  });

  it('Step 1(이메일 인증)부터 시작한다', () => {
    render(<SignupPageClient />);

    expect(screen.getByTestId('step-1-verify')).toBeInTheDocument();
  });

  it('인증 redirect와 draft restore 대기 중에는 접근 가능한 loading skeleton을 표시한다', () => {
    mockUseRedirectIfAuthenticated.mockImplementation(() => ({ isReadyToRender: false }));

    render(<SignupPageClient />);

    expect(screen.getByRole('status')).toHaveTextContent('회원가입 정보를 준비하고 있어요');
    expect(screen.queryByTestId('step-1-verify')).not.toBeInTheDocument();
  });

  it('4단계 progress label과 현재 단계 aria-current를 표시한다', () => {
    render(<SignupPageClient />);

    expect(screen.getByText('단계 1/4')).toBeInTheDocument();
    expect(screen.getByText('현재 단계: 학교 이메일 인증')).toBeInTheDocument();

    let progressList = screen.getByRole('list', { name: '회원가입 진행 단계' });
    expect(within(progressList).getByText('학교 이메일 인증').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );

    advanceToStep(3);

    expect(screen.getByText('단계 3/4')).toBeInTheDocument();
    expect(screen.getByText('현재 단계: 계정 정보 입력')).toBeInTheDocument();
    progressList = screen.getByRole('list', { name: '회원가입 진행 단계' });
    expect(within(progressList).getByText('계정 정보 입력').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );
  });

  it('4단계 계정 생성 플로우로 가입을 완료할 수 있다', async () => {
    render(<SignupPageClient />);

    advanceToStep(3);
    expect(screen.getByTestId('step-3-next')).toBeInTheDocument();

    await submitAccountIdentity();

    expect(mockSignup).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@kangwon.ac.kr',
        password: 'Test1234',
        nickname: 'tester',
        gender: 'M',
        campus: 'CHUNCHEON',
        collegeCode: 'IT',
        birthYear: VALID_SIGNUP_BIRTH_YEAR,
        legalAcceptances: SIGNUP_LEGAL_ACCEPTANCES,
      }),
    );
    expect(mockSignup).toHaveBeenCalledWith(
      expect.not.objectContaining({
        lifestyle: expect.anything(),
        intro: expect.anything(),
      }),
    );
    const completeButton = screen.getByTestId('step-complete');
    expect(completeButton).toBeInTheDocument();

    fireEvent.click(completeButton);
    expect(mockReplace).toHaveBeenCalledWith('/main');
  });

  it('진행 중 로고 클릭 시 이탈 확인 다이얼로그를 표시한다', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<SignupPageClient />);

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

    render(<SignupPageClient />);
    advanceToStep(3);

    await submitAccountIdentity();

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

    render(<SignupPageClient />);
    advanceToStep(3);

    await submitAccountIdentity();

    expect(screen.getByRole('status')).toHaveTextContent('최신 내용을 다시 확인');

    await act(async () => {
      fireEvent.click(screen.getByTestId('step-2-next'));
    });
    await waitFor(() => {
      expect(sessionStorage.getItem('signup-draft')).toContain('terms-of-service-2026-06-23');
    });
    await submitAccountIdentity();

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

  it('회원가입 실패 시 계정 정보 단계에 에러 메시지와 재시도 버튼을 표시한다', async () => {
    mockSignup.mockResolvedValue({
      success: false,
      error: '이미 가입된 이메일입니다.',
    });

    render(<SignupPageClient />);
    advanceToStep(3);

    await submitAccountIdentity();

    expect(screen.getByText('이미 가입된 이메일입니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(screen.getByTestId('step-3-next')).toBeInTheDocument();
  });

  it('이메일 인증 만료 에러가 나면 카드에 포커스하고 다시 인증 후 계정 정보 단계로 복귀시킨다', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    mockSignup.mockResolvedValueOnce({
      success: false,
      error: '이메일 인증을 먼저 완료해주세요.',
    });

    render(<SignupPageClient />);
    advanceToStep(3);

    await submitAccountIdentity();

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('이메일 인증을 먼저 완료해주세요.');
    expect(document.activeElement).toBe(alert);
    expect(screen.getByRole('button', { name: '이메일 다시 인증하기' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '이메일 다시 인증하기' }));
    expect(screen.getByTestId('step-1-verify')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('step-1-verify'));
    expect(screen.getByTestId('step-3-next')).toBeInTheDocument();
  });

  it('네트워크 오류 시 계정 정보 단계에 에러 메시지를 표시한다', async () => {
    mockSignup.mockRejectedValue(new Error('Network error'));

    render(<SignupPageClient />);
    advanceToStep(3);

    await submitAccountIdentity();

    expect(
      screen.getByText('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('step-3-next')).toBeInTheDocument();
  });

  describe('sessionStorage persist/restore', () => {
    it('legacy Step 4 이상에서 새로고침하면 Step 3으로 복원된다', () => {
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
          collegeCode: 'IT',
          birthYear: VALID_SIGNUP_BIRTH_YEAR,
          intro: '',
          lifestyle: {},
        }),
      );

      render(<SignupPageClient />);

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
        }),
      );

      render(<SignupPageClient />);

      expect(screen.getByTestId('step-2-next')).toBeInTheDocument();
    });

    it('약관 단계 draft에는 legal ids만 저장하고 문서 본문은 저장하지 않는다', async () => {
      render(<SignupPageClient />);

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

    it('계정 정보 단계까지 진행해도 draft에는 intro/lifestyle을 저장하지 않는다', async () => {
      render(<SignupPageClient />);

      advanceToStep(3);

      await waitFor(() => {
        const rawDraft = sessionStorage.getItem('signup-draft');
        expect(rawDraft).not.toBeNull();
        expect(rawDraft).not.toContain('intro');
        expect(rawDraft).not.toContain('lifestyle');
        expect(rawDraft).not.toContain('bedtime');
      });
    });

    it('회원가입 완료(Step 4) 시 sessionStorage가 삭제된다', async () => {
      render(<SignupPageClient />);

      advanceToStep(3);
      await submitAccountIdentity();

      expect(screen.getByTestId('step-complete')).toBeInTheDocument();
      expect(sessionStorage.getItem('signup-draft')).toBeNull();
    });

    it('로고 클릭 이탈 시 sessionStorage가 삭제된다', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      render(<SignupPageClient />);

      fireEvent.click(screen.getByTestId('step-1-verify'));
      fireEvent.click(screen.getByTestId('step-1-next'));
      expect(sessionStorage.getItem('signup-draft')).not.toBeNull();

      fireEvent.click(screen.getByTestId('logo'));

      expect(sessionStorage.getItem('signup-draft')).toBeNull();
    });
  });
});

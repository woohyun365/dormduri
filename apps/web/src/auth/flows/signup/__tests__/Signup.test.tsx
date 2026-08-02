import React from 'react';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SignupPageClient from '../SignupPageClient';
import { SIGNUP_EMAIL_PROOF_EXPIRED_NOTICE } from '../model/signup-recovery-copy';
import { authApi } from '@/auth/api';
import { useRedirectIfAuthenticated } from '@/auth/hooks';

const mockReplace = vi.fn();
const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
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
  Check: () => <span data-testid="icon-check" />,
  CheckCircle2: () => <span data-testid="icon-complete" />,
  ChevronLeft: () => <span data-testid="icon-back" />,
  GraduationCap: () => <span data-testid="icon-graduation" />,
  KeyRound: () => <span data-testid="icon-key" />,
  Mail: () => <span data-testid="icon-mail" />,
  Scale: () => <span data-testid="icon-scale" />,
  WifiOff: () => <span data-testid="icon-wifi-off" />,
}));

vi.mock('@/auth/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/auth/hooks')>();

  return {
    ...actual,
    useRedirectIfAuthenticated: vi.fn(() => ({
      isReadyToRender: true,
      sessionStatus: 'unauthenticated',
      retrySession: vi.fn(),
    })),
  };
});

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
    recoveryEmailError,
    recoveryNotice,
    onRecoveryErrorClear,
  }: {
    onNext: () => void;
    onVerified: () => void;
    onEmailChange: (email: string) => void;
    isVerified: boolean;
    recoveryEmailError?: string;
    recoveryNotice?: string;
    onRecoveryErrorClear?: () => void;
  }) => (
    <div>
      {recoveryEmailError && <p>{recoveryEmailError}</p>}
      {recoveryNotice && <p role="status">{recoveryNotice}</p>}
      <button
        data-testid="step-1-verify"
        onClick={() => {
          onEmailChange('test@kangwon.ac.kr');
          onRecoveryErrorClear?.();
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
    requiresReconfirmation,
  }: {
    onNext: () => void;
    onLegalConsentChange: (legalConsent: Record<string, unknown>) => void;
    requiresReconfirmation?: boolean;
  }) => (
    <div>
      {requiresReconfirmation && <p role="status">동의 내용을 다시 확인해 주세요.</p>}
      <button
        data-testid="step-2-next"
        onClick={() => {
          const legalAcceptances = requiresReconfirmation
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

vi.mock('../components/AccountCredentialsStep', () => ({
  AccountCredentialsStep: ({
    accountData,
    onNext,
    onAccountDataChange,
    serverFieldErrors,
    onServerErrorClear,
    onEmailProofExpired,
  }: {
    accountData: Record<string, unknown>;
    onNext: (data: Record<string, unknown>) => void | Promise<void>;
    onAccountDataChange: (data: Record<string, unknown>) => void;
    serverFieldErrors?: { nickname?: string; password?: string };
    onServerErrorClear?: () => void;
    onEmailProofExpired?: () => void;
  }) => (
    <div>
      <p data-testid="step-3-nickname">{String(accountData.nickname ?? '')}</p>
      {serverFieldErrors?.nickname && <p>{serverFieldErrors.nickname}</p>}
      {serverFieldErrors?.password && <p>{serverFieldErrors.password}</p>}
      <button
        data-testid="step-3-next"
        onClick={() => {
          const accountFixture = {
            nickname: 'tester',
            password: 'Test1234',
            passwordConfirm: 'Test1234',
            gender: 'M',
            campus: 'CHUNCHEON',
            collegeCode: 'CHUNCHEON_IT',
            birthYear: VALID_SIGNUP_BIRTH_YEAR,
          };
          onServerErrorClear?.();
          onAccountDataChange(accountFixture);
          void onNext(accountFixture);
        }}
      >
        계속하기
      </button>
      <button data-testid="step-3-expire-proof" onClick={onEmailProofExpired}>
        expire proof
      </button>
    </div>
  ),
}));

vi.mock('../components/AcademicIdentityStep', () => ({
  AcademicIdentityStep: ({
    accountData,
    onNext,
    serverFieldErrors,
    submissionError,
  }: {
    accountData: Record<string, unknown>;
    onNext: (data: Record<string, unknown>) => void | Promise<void>;
    serverFieldErrors?: Record<string, string>;
    submissionError?: string;
  }) => (
    <div>
      {Object.values(serverFieldErrors ?? {}).map((message) => (
        <p key={message}>{message}</p>
      ))}
      {submissionError && <p role="alert">{submissionError}</p>}
      <button data-testid="step-4-submit" onClick={() => void onNext(accountData)}>
        가입하기
      </button>
    </div>
  ),
}));

vi.mock('../components/SignupCompleteStep', () => ({
  SignupCompleteStep: ({ onGoToHome }: { onGoToHome: () => void }) => (
    <button data-testid="step-complete" onClick={onGoToHome}>
      가입 완료
    </button>
  ),
}));

vi.mock('@/auth/components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/auth/components')>();

  return {
    ...actual,
    AuthResponsiveFrame: ({
      children,
      supportPanel,
      onLogoClickAction,
    }: React.PropsWithChildren<{
      supportPanel: React.ReactNode;
      onLogoClickAction?: () => boolean;
    }>) => (
      <div>
        <button data-testid="logo" onClick={() => onLogoClickAction?.()}>
          Logo
        </button>
        <aside>{supportPanel}</aside>
        <main>{children}</main>
      </div>
    ),
    AuthServiceNotice: () => <p>독립 운영 서비스</p>,
  };
});

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
  if (step >= 4) fireEvent.click(screen.getByTestId('step-3-next'));
}

async function submitSignup() {
  await act(async () => {
    if (screen.queryByTestId('step-3-next')) {
      fireEvent.click(screen.getByTestId('step-3-next'));
    }
  });
  await act(async () => {
    fireEvent.click(screen.getByTestId('step-4-submit'));
  });
}

async function renderSignup() {
  const result = render(<SignupPageClient />);
  await waitFor(() => {
    expect(
      screen.queryByText('로그인 상태를 확인한 뒤 가입 화면을 준비할게요.'),
    ).not.toBeInTheDocument();
  });
  return result;
}

describe('SignupPageClient', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockSignup.mockReset();
    mockSignup.mockResolvedValue({ success: true });
    mockUseRedirectIfAuthenticated.mockReturnValue({
      isReadyToRender: true,
      sessionStatus: 'unauthenticated',
      retrySession: vi.fn(),
    });
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockReplace.mockClear();
    mockPush.mockClear();
  });

  it('Step 1(이메일 인증)부터 시작한다', async () => {
    await renderSignup();

    expect(screen.getByTestId('step-1-verify')).toBeInTheDocument();
  });

  it('인증 redirect 대기 중에는 접근 가능한 loading skeleton을 표시한다', async () => {
    mockUseRedirectIfAuthenticated.mockImplementation(() => ({
      isReadyToRender: false,
      sessionStatus: 'loading',
      retrySession: vi.fn(),
    }));

    render(<SignupPageClient />);
    await act(async () => Promise.resolve());

    expect(screen.getByRole('status')).toHaveTextContent('회원가입 정보를 준비하고 있어요');
    expect(screen.getByRole('status')).toHaveTextContent(
      '로그인 상태를 확인한 뒤 가입 화면을 준비할게요.',
    );
    expect(screen.queryByTestId('step-1-verify')).not.toBeInTheDocument();
  });

  it('session unavailable이어도 회원가입 flow와 복구 안내를 함께 표시한다', async () => {
    const retrySession = vi.fn();
    mockUseRedirectIfAuthenticated.mockReturnValue({
      isReadyToRender: true,
      sessionStatus: 'unavailable',
      retrySession,
    });

    await renderSignup();

    expect(screen.getByTestId('step-1-verify')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('로그인 상태를 확인하지 못했어요');
    expect(screen.getByRole('status')).toHaveTextContent('회원가입은 계속할 수 있어요.');
    fireEvent.click(screen.getByRole('button', { name: '다시 확인' }));
    expect(retrySession).toHaveBeenCalledTimes(1);
  });

  it('5단계 progress와 현재 단계 aria-current를 표시한다', async () => {
    await renderSignup();

    expect(screen.getByText('1/5 · 학교 이메일')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '학교 이메일 단계' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    );

    let progressNavigation = screen.getByRole('navigation', { name: '회원가입 진행 단계' });
    expect(within(progressNavigation).getByText('학교 이메일').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );

    advanceToStep(3);

    expect(screen.getByText('3/5 · 로그인 정보')).toBeInTheDocument();
    progressNavigation = screen.getByRole('navigation', { name: '회원가입 진행 단계' });
    expect(within(progressNavigation).getByText('로그인 정보').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );
  });

  it('5단계 계정 생성 플로우로 가입을 완료할 수 있다', async () => {
    await renderSignup();

    advanceToStep(3);
    expect(screen.getByTestId('step-3-next')).toBeInTheDocument();

    await submitSignup();

    expect(mockSignup).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@kangwon.ac.kr',
        password: 'Test1234',
        nickname: 'tester',
        gender: 'M',
        campus: 'CHUNCHEON',
        collegeCode: 'CHUNCHEON_IT',
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
    expect(screen.getByText('5/5 · 가입 완료')).toBeInTheDocument();
    const completedNavigation = screen.getByRole('navigation', { name: '회원가입 진행 단계' });
    expect(completedNavigation.querySelector('[aria-current="step"]')).toBeNull();
    expect(within(completedNavigation).getAllByTestId('icon-check')).toHaveLength(5);

    fireEvent.click(completeButton);
    expect(mockReplace).toHaveBeenCalledWith('/main');
  });

  it('진행 중 로고 클릭 시 이탈 확인 다이얼로그를 표시한다', async () => {
    await renderSignup();

    fireEvent.click(screen.getByTestId('step-1-verify'));
    fireEvent.click(screen.getByTestId('step-1-next'));

    fireEvent.click(screen.getByTestId('logo'));

    expect(screen.getByRole('alertdialog')).toHaveTextContent('가입을 그만둘까요?');
    expect(screen.getByRole('button', { name: '계속 작성' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '나가기' })).toBeInTheDocument();
  });

  it('legal acceptance stale 실패 시 약관 단계로 되돌리고 재확인을 요구한다', async () => {
    mockSignup.mockResolvedValueOnce({
      success: false,
      code: 'AUTH_LEGAL_ACCEPTANCE_STALE',
      error: '약관 또는 개인정보 동의 내용이 변경되었습니다.',
    });

    await renderSignup();
    advanceToStep(3);

    await submitSignup();

    expect(screen.getByTestId('step-2-next')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('동의 내용을 다시 확인');
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

    await renderSignup();
    advanceToStep(3);

    await submitSignup();

    expect(screen.getByRole('status')).toHaveTextContent('동의 내용을 다시 확인');

    await act(async () => {
      fireEvent.click(screen.getByTestId('step-2-next'));
    });
    await submitSignup();

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

  it('이미 가입된 이메일 실패는 이메일 단계의 field recovery로 연결한다', async () => {
    mockSignup.mockResolvedValue({
      success: false,
      code: 'AUTH_EMAIL_ALREADY_REGISTERED',
      error: '이미 가입된 이메일입니다.',
      fieldErrors: { email: '이미 가입된 이메일입니다.' },
    });

    await renderSignup();
    advanceToStep(3);

    await submitSignup();

    expect(screen.getByText('이미 가입된 이메일입니다.')).toBeInTheDocument();
    expect(screen.getByTestId('step-1-verify')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
  });

  it('최종 가입에서 닉네임이 선점되면 다른 입력을 보존한 채 로그인 정보 단계로 복구한다', async () => {
    mockSignup.mockResolvedValue({
      success: false,
      code: 'AUTH_NICKNAME_ALREADY_TAKEN',
      error: '이미 사용 중인 닉네임이에요.',
      fieldErrors: { nickname: '이미 사용 중인 닉네임이에요.' },
    });

    await renderSignup();
    advanceToStep(3);
    await submitSignup();

    expect(screen.getByTestId('step-3-next')).toBeInTheDocument();
    expect(screen.getByTestId('step-3-nickname')).toHaveTextContent('tester');
    expect(screen.getByText('이미 사용 중인 닉네임이에요.')).toBeInTheDocument();
    expect(screen.queryByTestId('step-4-submit')).not.toBeInTheDocument();
  });

  it('최종 전송에서 이메일 proof 만료가 확인되면 Step 1로 초기화하고 재인증 후 정상 흐름을 시작한다', async () => {
    mockSignup.mockResolvedValueOnce({
      success: false,
      code: 'AUTH_SIGNUP_EMAIL_VERIFICATION_REQUIRED',
      error: '이메일 인증을 먼저 완료해주세요.',
    });

    await renderSignup();
    advanceToStep(3);

    await submitSignup();

    expect(screen.getByRole('status')).toHaveTextContent(SIGNUP_EMAIL_PROOF_EXPIRED_NOTICE);
    expect(screen.getByTestId('step-1-verify')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '이메일 다시 인증하기' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('step-1-verify'));
    expect(screen.getByTestId('step-1-next')).toBeInTheDocument();
    expect(screen.queryByTestId('step-4-submit')).not.toBeInTheDocument();
  });

  it('닉네임 확인 중 이메일 proof가 만료되면 즉시 Step 1 재인증 흐름으로 복구한다', async () => {
    await renderSignup();
    advanceToStep(3);

    fireEvent.click(screen.getByTestId('step-3-expire-proof'));

    expect(screen.getByTestId('step-1-verify')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(SIGNUP_EMAIL_PROOF_EXPIRED_NOTICE);
    expect(screen.queryByTestId('step-3-next')).not.toBeInTheDocument();
  });

  it('네트워크 오류 시 계정 정보 단계에 에러 메시지를 표시한다', async () => {
    mockSignup.mockRejectedValue(new Error('Network error'));

    await renderSignup();
    advanceToStep(3);

    await submitSignup();

    expect(screen.getByText('네트워크를 확인한 뒤 다시 시도해 주세요.')).toBeInTheDocument();
    expect(screen.getByTestId('step-4-submit')).toBeInTheDocument();
  });

  it('이전 signup-draft가 남아 있어도 Resume을 제안하지 않고 Step 1에서 시작한다', async () => {
    sessionStorage.setItem(
      'signup-draft',
      JSON.stringify({
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        currentStepId: 'ACADEMIC_IDENTITY',
        email: 'test@kangwon.ac.kr',
        emailVerifiedAt: new Date().toISOString(),
        terms: {
          agreeAge: true,
          agreeTerms: true,
          agreePersonalDataCollectionUse: true,
          legalAcceptances: SIGNUP_LEGAL_ACCEPTANCES,
        },
        nickname: 'tester',
        gender: 'M',
        campus: 'CHUNCHEON',
        collegeCode: 'CHUNCHEON_IT',
        birthYear: VALID_SIGNUP_BIRTH_YEAR,
      }),
    );

    await renderSignup();

    expect(screen.getByTestId('step-1-verify')).toBeInTheDocument();
    expect(
      screen.queryByRole('alertdialog', { name: /이전에 입력한 정보/ }),
    ).not.toBeInTheDocument();
  });
});

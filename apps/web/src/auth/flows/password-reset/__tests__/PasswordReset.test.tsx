import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '@/auth/api';
import { RESET_PASSWORD_VERIFICATION_CODE_TTL_SECONDS } from '@repo/shared/auth/policy';
import PasswordResetPageClient from '../PasswordResetPageClient';

const mockRouterPush = vi.fn();
const mockRouterReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, replace: mockRouterReplace }),
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
  Mail: () => <span data-testid="icon-mail" />,
  Lock: () => <span data-testid="icon-lock" />,
  Check: () => <span data-testid="icon-check" />,
  CheckCircle: () => <span data-testid="icon-check-circle" />,
  CheckCircle2: () => <span data-testid="icon-check-circle-2" />,
  LoaderCircle: () => <span data-testid="icon-loader-circle" />,
  CircleUserRound: () => <span data-testid="icon-circle-user" />,
  AlertCircle: () => <span data-testid="icon-alert-circle" />,
  CircleAlert: () => <span data-testid="icon-circle-alert" />,
  Clock3: () => <span data-testid="icon-clock" />,
  Info: () => <span data-testid="icon-info" />,
  LogOut: () => <span data-testid="icon-log-out" />,
  Timer: () => <span data-testid="icon-timer" />,
  WifiOff: () => <span data-testid="icon-wifi-off" />,
  CircleHelp: () => <span data-testid="icon-circle-help" />,
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  ChevronLeft: () => <span data-testid="icon-chevron-left" />,
  Eye: () => <span data-testid="icon-eye" />,
  EyeOff: () => <span data-testid="icon-eye-off" />,
}));

vi.mock('@/auth/api', () => ({
  authApi: {
    sendResetCode: vi.fn(),
    verifyResetCode: vi.fn(),
    resetPassword: vi.fn(),
    resolveSession: vi.fn(),
  },
}));

const mockSendCode = vi.mocked(authApi.sendResetCode);
const mockVerifyCode = vi.mocked(authApi.verifyResetCode);
const mockResetPassword = vi.mocked(authApi.resetPassword);
const mockResolveSession = vi.mocked(authApi.resolveSession);
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
let scrollIntoViewMock: ReturnType<typeof vi.fn>;

async function renderPage() {
  const result = render(<PasswordResetPageClient />);
  await act(async () => {
    await Promise.resolve();
  });
  return result;
}

async function fillAndSubmitEmail() {
  fireEvent.change(screen.getByLabelText(/^학교 이메일/, { selector: 'input' }), {
    target: { value: 'test@kangwon.ac.kr' },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '인증 코드 받기' }));
  });
}

async function advanceToNewPassword() {
  await verifyEmailCode();
  fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));
}

async function verifyEmailCode() {
  await fillAndSubmitEmail();
  fireEvent.change(screen.getByLabelText(/^인증 코드/, { selector: 'input' }), {
    target: { value: '123456' },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '인증 확인' }));
  });
}

async function submitNewPassword() {
  fireEvent.change(screen.getByLabelText(/^새 비밀번호/, { selector: 'input' }), {
    target: { value: 'Test1234' },
  });
  fireEvent.change(screen.getByLabelText(/^비밀번호 확인/, { selector: 'input' }), {
    target: { value: 'Test1234' },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '새 비밀번호 저장' }));
  });
}

describe('PasswordResetPageClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    scrollIntoViewMock = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoViewMock,
    });
    mockSendCode.mockResolvedValue({ success: true });
    mockVerifyCode.mockResolvedValue({ success: true, grantExpiresInSeconds: 900 });
    mockResetPassword.mockResolvedValue({ success: true });
    mockResolveSession.mockResolvedValue({ status: 'unauthenticated' });
    mockRouterPush.mockClear();
    mockRouterReplace.mockClear();
  });

  afterEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: originalScrollIntoView,
    });
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('code request 성공은 임의 지연 없이 neutral verification 화면으로 이동한다', async () => {
    await renderPage();
    await fillAndSubmitEmail();

    expect(screen.getByRole('heading', { name: '인증 코드 확인' })).toBeInTheDocument();
    expect(screen.getByText('1/2 · 학교 이메일 인증')).toBeInTheDocument();
    expect(screen.getByLabelText('인증 코드를 요청한 주소')).toHaveTextContent(
      'test@kangwon.ac.kr',
    );
    expect(screen.queryByText(/발송 완료/)).not.toBeInTheDocument();
    expect(mockSendCode).toHaveBeenCalledWith('test@kangwon.ac.kr', expect.any(AbortSignal));

    const resendButton = screen.getByRole('button', { name: '재전송 · 10:00' });
    const verifyButton = screen.getByRole('button', { name: '인증 확인' });
    expect(resendButton).toBeDisabled();
    expect(
      resendButton.compareDocumentPosition(verifyButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('verification에서 뒤로가면 email 단계로 돌아가고 code 입력을 제거한다', async () => {
    await renderPage();
    await fillAndSubmitEmail();
    fireEvent.change(screen.getByLabelText(/^인증 코드/, { selector: 'input' }), {
      target: { value: '123456' },
    });

    fireEvent.click(screen.getByLabelText('뒤로가기'));

    expect(screen.getByRole('heading', { name: '학교 이메일 확인' })).toBeInTheDocument();
    expect(screen.queryByLabelText('인증 코드', { selector: 'input' })).not.toBeInTheDocument();
  });

  it('메일 도움말은 상시 노출하고 이메일 다시 입력 action으로 email 단계에 돌아간다', async () => {
    await renderPage();
    await fillAndSubmitEmail();

    expect(screen.getByText('인증 메일이 보이지 않나요?')).toBeVisible();
    expect(screen.getByText('스팸함에도 없다면 이메일 주소를 확인해 주세요.')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '이메일 다시 입력' }));

    expect(screen.getByRole('heading', { name: '학교 이메일 확인' })).toBeInTheDocument();
    expect(screen.queryByLabelText('인증 코드', { selector: 'input' })).not.toBeInTheDocument();
  });

  it('code 만료 시 확인을 막고 새 코드 요청을 유지한다', async () => {
    await renderPage();
    await fillAndSubmitEmail();

    expect(screen.getByRole('button', { name: '재전송 · 10:00' })).toBeDisabled();
    act(() => {
      vi.advanceTimersByTime(RESET_PASSWORD_VERIFICATION_CODE_TTL_SECONDS * 1_000);
    });

    expect(screen.getByText('인증 시간이 만료됐어요. 새 인증 코드를 받아주세요.')).toBeVisible();
    expect(screen.getByRole('button', { name: '인증 확인' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '재전송' })).toBeEnabled();
  });

  it('code 만료 후 재전송 요청을 보내고 countdown을 다시 시작한다', async () => {
    let resolveSend!: (value: { success: true }) => void;
    await renderPage();
    await fillAndSubmitEmail();
    fireEvent.change(screen.getByLabelText(/^인증 코드/, { selector: 'input' }), {
      target: { value: '123456' },
    });
    act(() => {
      vi.advanceTimersByTime(RESET_PASSWORD_VERIFICATION_CODE_TTL_SECONDS * 1_000);
    });
    mockSendCode.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve;
        }),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '재전송' }));
    });

    expect(screen.getByRole('button', { name: '전송 중...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '인증 확인' })).toBeDisabled();
    await act(async () => resolveSend({ success: true }));
    expect(screen.getByRole('button', { name: '재전송 · 10:00' })).toBeDisabled();
    expect(screen.getByLabelText(/^인증 코드/, { selector: 'input' })).toHaveValue('');
    expect(screen.getByRole('status')).toHaveTextContent('새 인증 코드를 보냈어요');
    expect(mockSendCode).toHaveBeenCalledTimes(2);
  });

  it('code 재전송 실패는 기존 입력을 유지하고 실패 feedback을 표시한다', async () => {
    await renderPage();
    await fillAndSubmitEmail();
    fireEvent.change(screen.getByLabelText(/^인증 코드/, { selector: 'input' }), {
      target: { value: '123456' },
    });
    act(() => {
      vi.advanceTimersByTime(RESET_PASSWORD_VERIFICATION_CODE_TTL_SECONDS * 1_000);
    });
    mockSendCode.mockResolvedValueOnce({ success: false, error: '메일 전송 실패' });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '재전송' }));
    });

    expect(screen.getByLabelText(/^인증 코드/, { selector: 'input' })).toHaveValue('123456');
    expect(screen.getByRole('alert')).toHaveTextContent('인증 코드를 보낼 수 없어요');
    expect(screen.getByRole('alert')).toHaveTextContent('메일 전송 실패');
  });

  it('email 변경과 unmount는 진행 중인 실제 request signal을 abort한다', async () => {
    let signal: AbortSignal | undefined;
    mockSendCode.mockImplementationOnce(
      (_email, requestSignal) =>
        new Promise(() => {
          signal = requestSignal;
        }),
    );
    const { unmount } = await renderPage();

    fireEvent.change(screen.getByLabelText(/^학교 이메일/, { selector: 'input' }), {
      target: { value: 'first@kangwon.ac.kr' },
    });
    fireEvent.click(screen.getByRole('button', { name: '인증 코드 받기' }));
    await act(async () => Promise.resolve());

    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it('인증 확인 중 뒤로가면 request를 abort하고 늦은 성공을 반영하지 않는다', async () => {
    let resolveVerification!: (value: { success: true; grantExpiresInSeconds: number }) => void;
    let signal: AbortSignal | undefined;
    mockVerifyCode.mockImplementationOnce(
      (_email, _code, requestSignal) =>
        new Promise((resolve) => {
          signal = requestSignal;
          resolveVerification = resolve;
        }),
    );
    await renderPage();
    await fillAndSubmitEmail();
    fireEvent.change(screen.getByLabelText(/^인증 코드/, { selector: 'input' }), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: '인증 확인' }));
    await act(async () => Promise.resolve());

    fireEvent.click(screen.getByLabelText('뒤로가기'));
    expect(signal?.aborted).toBe(true);
    await act(async () => resolveVerification({ success: true, grantExpiresInSeconds: 900 }));

    expect(screen.getByRole('heading', { name: '학교 이메일 확인' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '새 비밀번호 만들기' })).not.toBeInTheDocument();
  });

  it('인증 확인 network 실패는 code field 오류와 중복하지 않고 현재 단계를 유지한다', async () => {
    mockVerifyCode.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await renderPage();
    await fillAndSubmitEmail();
    fireEvent.change(screen.getByLabelText(/^인증 코드/, { selector: 'input' }), {
      target: { value: '123456' },
    });
    scrollIntoViewMock.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '인증 확인' }));
    });

    const feedback = screen.getByTestId('password-reset-feedback-region');
    const feedbackTitle = within(feedback).getByText('인증 코드를 확인하지 못했어요');
    expect(feedback).toHaveTextContent('인증 코드를 확인하지 못했어요');
    expect(feedbackTitle).toHaveFocus();
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });
    expect(screen.queryByText('인증 코드가 올바르지 않습니다.')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^인증 코드/, { selector: 'input' })).toHaveValue('123456');
  });

  it('인증 코드 확인을 5회 실패하면 현재 코드를 막고 재전송만 허용한다', async () => {
    mockVerifyCode.mockResolvedValue({
      success: false,
      code: 'AUTH_VERIFICATION_CODE_INVALID',
      fieldErrors: { code: '인증 코드가 올바르지 않습니다.' },
    });
    await renderPage();
    await fillAndSubmitEmail();
    fireEvent.change(screen.getByLabelText(/^인증 코드/, { selector: 'input' }), {
      target: { value: '123456' },
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '인증 확인' }));
      });
    }

    const feedback = screen.getByTestId('password-reset-feedback-region');
    expect(feedback).toHaveTextContent('인증 코드를 다시 받아 주세요');
    expect(feedback).toHaveTextContent('새 코드로 다시 인증해 주세요.');
    expect(screen.getByLabelText(/^인증 코드/, { selector: 'input' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '인증 확인' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '재전송' })).toBeEnabled();
    expect(
      screen.queryByText('인증 시간이 만료됐어요. 새 인증 코드를 받아주세요.'),
    ).not.toBeInTheDocument();
  });

  it('검증 grant와 새 비밀번호 제출을 거쳐 완료 결과로 이동한다', async () => {
    await renderPage();
    await verifyEmailCode();

    expect(mockVerifyCode).toHaveBeenCalledWith(
      'test@kangwon.ac.kr',
      '123456',
      expect.any(AbortSignal),
    );
    expect(screen.getByText('인증완료')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다음 단계' })).toBeEnabled();
    expect(screen.queryByRole('heading', { name: '새 비밀번호 만들기' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

    expect(screen.getByRole('heading', { name: '새 비밀번호 만들기' })).toHaveFocus();
    expect(screen.getByText('2/2 · 새 비밀번호 변경')).toBeInTheDocument();
    expect(screen.getByText('인증된 학교 이메일')).toBeInTheDocument();
    expect(screen.getByText('test@kangwon.ac.kr')).toBeInTheDocument();
    expect(screen.queryByLabelText('뒤로가기')).not.toBeInTheDocument();

    await submitNewPassword();

    expect(mockResetPassword).toHaveBeenCalledWith(
      'test@kangwon.ac.kr',
      'Test1234',
      expect.any(AbortSignal),
    );
    expect(screen.getByRole('heading', { name: '비밀번호가 변경됐어요' })).toBeInTheDocument();
    expect(screen.getByText('새 비밀번호로 다시 로그인해 주세요.')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('password-reset-flow-card')).getByText(
        /기존 로그인은 모두 종료됐어요/,
      ),
    ).toBeInTheDocument();
  });

  it('verified 상태에서 grant가 만료되면 다음 단계 대신 학교 이메일 인증을 다시 시작한다', async () => {
    mockVerifyCode.mockResolvedValueOnce({ success: true, grantExpiresInSeconds: 1 });
    await renderPage();
    await verifyEmailCode();

    act(() => vi.advanceTimersByTime(1_000));
    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

    expect(screen.getByRole('heading', { name: '학교 이메일 확인' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('인증 시간이 만료됐어요');
    expect(screen.queryByRole('heading', { name: '새 비밀번호 만들기' })).not.toBeInTheDocument();
  });

  it('새 비밀번호 저장 network 실패는 입력을 유지하고 같은 CTA로 재시도할 수 있다', async () => {
    mockResetPassword.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await renderPage();
    await advanceToNewPassword();
    await submitNewPassword();

    expect(screen.getByTestId('password-reset-feedback-region')).toHaveTextContent(
      '새 비밀번호를 저장하지 못했어요',
    );
    expect(screen.getByLabelText(/^새 비밀번호/, { selector: 'input' })).toHaveValue('Test1234');
    expect(screen.getByRole('button', { name: '새 비밀번호 저장' })).toBeEnabled();
  });

  it('완료 CTA는 reset success query를 사용해 login으로 replace한다', async () => {
    await renderPage();
    await advanceToNewPassword();
    await submitNewPassword();

    fireEvent.click(screen.getByRole('button', { name: '로그인하기' }));

    expect(mockRouterReplace).toHaveBeenCalledWith('/login?reset=success');
    expect(mockRouterPush).not.toHaveBeenCalledWith('/login?reset=success');
  });

  it('layout은 sticky rail과 mobile full-bleed step sheet를 사용한다', async () => {
    await renderPage();

    const supportPanel = screen.getByTestId('password-reset-help-panel');
    const flowCard = screen.getByTestId('password-reset-flow-card');
    expect(supportPanel).toHaveClass('hidden', 'lg:block');
    expect(supportPanel.className).toContain('sticky');
    expect(flowCard).toHaveClass('-mx-5', 'border-y', 'sm:mx-0', 'sm:rounded-4xl');
    const progressNavigation = screen.getByRole('navigation', {
      name: '비밀번호 재설정 진행 단계',
    });
    expect(progressNavigation).toBeVisible();
    expect(within(progressNavigation).getByText('학교 이메일 인증')).toBeInTheDocument();
    expect(within(progressNavigation).getByText('새 비밀번호 변경')).toBeInTheDocument();
    expect(within(progressNavigation).queryByText('인증 코드')).not.toBeInTheDocument();
  });

  it('전송 rate limit은 feedback의 남은 시간과 안정적인 비활성 CTA로 안내한다', async () => {
    mockSendCode.mockResolvedValueOnce({ success: false, retryAfterSeconds: 3 });
    await renderPage();
    scrollIntoViewMock.mockClear();
    await fillAndSubmitEmail();

    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent('잠시 후 다시 요청할 수 있어요');
    expect(screen.getByText('잠시 후 다시 요청할 수 있어요')).toHaveFocus();
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('timer')).toHaveTextContent('남은 시간: 3초');
    expect(screen.getByRole('button', { name: '인증 코드 받기' })).toBeDisabled();

    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByRole('timer')).toHaveTextContent('남은 시간: 2초');
    expect(screen.getByRole('button', { name: '인증 코드 받기' })).toBeDisabled();
  });

  it('network 실패는 form 상단 compact feedback으로 안내하고 즉시 재시도할 수 있다', async () => {
    mockSendCode.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await renderPage();
    scrollIntoViewMock.mockClear();
    await fillAndSubmitEmail();

    const feedback = screen.getByTestId('password-reset-feedback-region');
    expect(feedback).toHaveTextContent('인증 코드를 보내지 못했어요');
    expect(feedback).toHaveTextContent('네트워크를 확인한 뒤 다시 시도해 주세요.');
    expect(within(feedback).getByTestId('icon-wifi-off')).toBeInTheDocument();
    expect(within(feedback).getByText('인증 코드를 보내지 못했어요')).toHaveFocus();
    expect(
      feedback.compareDocumentPosition(
        screen.getByLabelText(/^학교 이메일/, { selector: 'input' }),
      ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByRole('button', { name: '인증 코드 받기' })).toBeEnabled();
  });

  it('session 확인 중에는 password reset form 대신 checking 상태를 렌더링한다', () => {
    mockResolveSession.mockReturnValueOnce(new Promise(() => undefined));

    render(<PasswordResetPageClient />);

    expect(screen.getByRole('status')).toHaveTextContent('로그인 상태를 확인하고 있어요');
    expect(screen.getByRole('status')).toHaveTextContent('잠시만 기다려 주세요.');
    expect(screen.queryByLabelText(/^학교 이메일/, { selector: 'input' })).not.toBeInTheDocument();
  });

  it('로그인된 세션은 password reset 접근을 막고 main으로 이동한다', async () => {
    mockResolveSession.mockResolvedValueOnce({
      status: 'authenticated',
      user: {
        id: 'user-1',
        email: 'user@kangwon.ac.kr',
        nickname: '테스터',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
    });

    await renderPage();

    expect(mockRouterReplace).toHaveBeenCalledWith('/main');
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'redirecting');
    expect(screen.getByRole('status')).toHaveTextContent('로그인되어 있어요');
    expect(screen.getByRole('status')).toHaveTextContent('메인으로 이동하고 있어요.');
    expect(screen.queryByLabelText(/^학교 이메일/, { selector: 'input' })).not.toBeInTheDocument();
  });

  it('session unavailable은 password reset flow를 차단하지 않는다', async () => {
    mockResolveSession.mockResolvedValueOnce({
      status: 'unavailable',
      code: 'AUTH_SESSION_UNAVAILABLE',
    });
    await renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('로그인 상태를 확인하지 못했어요');
    expect(screen.getByRole('status')).toHaveTextContent('비밀번호 재설정은 계속할 수 있어요.');
    expect(screen.getByRole('button', { name: '다시 확인' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '인증 코드 받기' })).toBeEnabled();
  });

  it('인증 코드 입력은 one-time-code와 numeric keyboard를 사용한다', async () => {
    await renderPage();
    await fillAndSubmitEmail();

    const codeInput = screen.getByLabelText(/^인증 코드/, { selector: 'input' });
    expect(codeInput).toHaveAttribute('autocomplete', 'one-time-code');
    expect(codeInput).toHaveAttribute('inputmode', 'numeric');
  });

  it('field error는 입력 필드 한 곳에만 표시한다', async () => {
    mockResetPassword.mockResolvedValueOnce({
      success: false,
      code: 'AUTH_PASSWORD_UNCHANGED',
      error: '현재 비밀번호와 동일한 비밀번호는 사용할 수 없습니다.',
      fieldErrors: {
        newPassword: '현재 비밀번호와 동일한 비밀번호는 사용할 수 없습니다.',
      },
    });
    await renderPage();
    await advanceToNewPassword();
    await submitNewPassword();

    expect(
      screen.getAllByText('현재 비밀번호와 동일한 비밀번호는 사용할 수 없습니다.'),
    ).toHaveLength(1);
    expect(screen.queryByTestId('password-reset-feedback-region')).not.toBeInTheDocument();
  });

  it('grant 만료 결과는 이메일 단계로 이동하고 CTA 없는 안내를 제공한다', async () => {
    mockResetPassword.mockResolvedValueOnce({
      success: false,
      code: 'AUTH_RESET_RESTART_REQUIRED',
      error: '비밀번호 재설정 요청을 다시 진행해주세요.',
    });
    await renderPage();
    await advanceToNewPassword();
    await submitNewPassword();

    const feedback = screen.getByTestId('password-reset-feedback-region');
    expect(feedback).toHaveAttribute('role', 'alert');
    expect(feedback).toHaveTextContent('인증 시간이 만료됐어요');
    expect(feedback).toHaveTextContent('학교 이메일 인증부터 다시 진행해 주세요.');
    expect(within(feedback).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '학교 이메일 확인' })).toBeInTheDocument();
  });

  it('grant TTL이 지나면 API를 호출하지 않고 이메일 재시작을 안내한다', async () => {
    mockVerifyCode.mockResolvedValueOnce({ success: true, grantExpiresInSeconds: 1 });
    await renderPage();
    await advanceToNewPassword();
    act(() => vi.advanceTimersByTime(1_001));
    mockResetPassword.mockClear();

    await submitNewPassword();

    expect(mockResetPassword).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: '학교 이메일 확인' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('인증 시간이 만료됐어요');
  });
});

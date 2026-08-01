import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LoginForm } from '../LoginForm';
import type { LoginFormValues } from '../../model/login-form.types';

vi.mock('lucide-react', () => ({
  Lock: () => <span data-testid="icon-lock" />,
  AlertCircle: () => <span data-testid="icon-alert" />,
  CheckCircle: () => <span data-testid="icon-check-circle" />,
  Info: () => <span data-testid="icon-info" />,
  Timer: () => <span data-testid="icon-timer" />,
  WifiOff: () => <span data-testid="icon-wifi-off" />,
  Eye: () => <span data-testid="icon-eye" />,
  EyeOff: () => <span data-testid="icon-eye-off" />,
  Check: () => <span data-testid="icon-check-mark" />,
  Mail: () => <span data-testid="icon-mail" />,
}));

function renderLoginForm(overrides: Partial<Parameters<typeof LoginForm>[0]> = {}) {
  const values: LoginFormValues = {
    email: '',
    password: '',
    rememberMe: false,
  };

  const props: Parameters<typeof LoginForm>[0] = {
    values,
    fieldErrors: {},
    uiError: null,
    isSubmitting: false,
    isRedirecting: false,
    isLocked: false,
    isSubmitDisabled: false,
    cooldownLabel: '0:00',
    lastInvalidField: null,
    invalidSubmitCount: 0,
    onEmailChange: vi.fn(),
    onPasswordChange: vi.fn(),
    onRememberMeChange: vi.fn(),
    onPasswordResetClick: vi.fn(),
    onSubmit: vi.fn((event) => event.preventDefault()),
    ...overrides,
  };

  return { ...render(<LoginForm {...props} />), props };
}

describe('LoginForm', () => {
  it('form control과 submit을 presentational props로 연결한다', () => {
    const { props } = renderLoginForm();

    expect(screen.getByRole('heading', { name: '로그인' })).toBeInTheDocument();
    expect(screen.getByText('가입한 학교 이메일로 접속해요.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '로그인' }).closest('form')).toBe(
      screen.getByRole('button', { name: '로그인' }).closest('form'),
    );
    expect(screen.getByTestId('login-card-header')).toHaveAttribute('data-slot', 'card-header');
    expect(screen.getByTestId('login-card-header')).toHaveClass('text-center');
    expect(screen.getByTestId('login-field-group')).toHaveAttribute('data-slot', 'field-group');
    const rememberMeHint = screen.getByText('개인 기기에서만 권장해요');
    expect(rememberMeHint).toBeInTheDocument();
    expect(rememberMeHint).toHaveClass('col-span-2', 'mt-0.5', 'pl-8');
    expect(rememberMeHint).not.toHaveClass('mt-1', 'gap-y-1');
    expect(screen.getByTestId('login-secondary-actions')).toHaveClass(
      'grid-cols-[minmax(0,1fr)_auto]',
      'items-start',
    );
    expect(
      screen.getByRole('checkbox', { name: '로그인 유지(최대 7일)' }),
    ).toHaveAccessibleDescription('개인 기기에서만 권장해요');
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'test@kangwon.ac.kr' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('checkbox', { name: '로그인 유지(최대 7일)' }));
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 찾기' }));
    fireEvent.submit(screen.getByRole('button', { name: '로그인' }).closest('form')!);

    expect(props.onEmailChange).toHaveBeenCalledWith('test@kangwon.ac.kr');
    expect(props.onPasswordChange).toHaveBeenCalledWith('password123');
    expect(props.onRememberMeChange).toHaveBeenCalledWith(true);
    expect(props.onPasswordResetClick).toHaveBeenCalled();
    expect(props.onSubmit).toHaveBeenCalled();
  });

  it('password manager와 mobile keyboard용 input attribute를 제공한다', () => {
    renderLoginForm();

    expect(screen.getByLabelText('이메일')).toHaveAttribute('name', 'email');
    expect(screen.getByLabelText('이메일')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('이메일')).toHaveAttribute('inputmode', 'email');
    expect(screen.getByLabelText('비밀번호')).toHaveAttribute('name', 'password');
    expect(screen.getByLabelText('비밀번호')).toHaveAttribute('autocomplete', 'current-password');
  });

  it('password manager에서 붙여 넣은 비밀번호를 차단하지 않는다', async () => {
    const { props } = renderLoginForm();
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('비밀번호'));
    await user.paste('PastedPassword123!');

    expect(props.onPasswordChange).toHaveBeenCalledWith('PastedPassword123!');
  });

  it('invalid submit 직후 첫 invalid field로 focus를 이동한다', () => {
    const { rerender, props } = renderLoginForm();

    rerender(
      <LoginForm
        {...props}
        fieldErrors={{ email: '이메일을 입력해주세요.', password: '비밀번호를 입력해주세요.' }}
        lastInvalidField="email"
        invalidSubmitCount={1}
      />,
    );

    expect(screen.getByLabelText('이메일')).toHaveFocus();

    rerender(
      <LoginForm
        {...props}
        fieldErrors={{ password: '비밀번호를 입력해주세요.' }}
        lastInvalidField="password"
        invalidSubmitCount={2}
      />,
    );

    expect(screen.getByLabelText('비밀번호')).toHaveFocus();
  });

  it('field error, rememberMe hint, locked disabled state를 표시한다', () => {
    renderLoginForm({
      values: { email: 'test@kangwon.ac.kr', password: '', rememberMe: true },
      fieldErrors: { password: '비밀번호를 입력해주세요.' },
      uiError: {
        status: 'locked',
        message: '반복된 로그인 실패로 계정이 잠겼어요.',
        remainingSeconds: 300,
      },
      isLocked: true,
      isSubmitDisabled: true,
      cooldownLabel: '5:00',
    });

    expect(screen.getByText('비밀번호를 입력해주세요.')).toBeInTheDocument();
    expect(screen.getByText('개인 기기에서만 권장해요')).toBeInTheDocument();
    const passwordResetAction = screen.getByRole('button', { name: '비밀번호 찾기' });
    expect(passwordResetAction).toHaveClass('h-5', 'shrink-0', 'items-start');
    expect(passwordResetAction.parentElement).toHaveClass('grid-cols-[minmax(0,1fr)_auto]');
    expect(passwordResetAction.parentElement).not.toHaveClass('absolute');
    expect(screen.getByRole('button', { name: '계정 잠금 중' })).toBeDisabled();
    expect(screen.getByRole('timer')).toHaveTextContent('남은 시간: 5:00');
  });

  it('로그인 성공 후 홈 이동 중 상태를 명시하고 입력을 잠근다', () => {
    renderLoginForm({
      isRedirecting: true,
      isSubmitDisabled: true,
    });

    expect(screen.getByRole('button', { name: '홈으로 이동 중...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '홈으로 이동 중...' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(
      screen.getByRole('button', { name: '홈으로 이동 중...' }).closest('form'),
    ).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('홈으로 이동 중');
    expect(screen.getByLabelText('이메일')).toBeDisabled();
    expect(screen.getByLabelText('비밀번호')).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: '로그인 유지(최대 7일)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '비밀번호 찾기' })).toBeDisabled();
  });

  it('mobile form은 full-bleed이고 sm부터 card surface로 전환한다', () => {
    renderLoginForm();

    const form = screen.getByRole('button', { name: '로그인' }).closest('form');
    expect(form).toHaveClass('-mx-5', 'border-y', 'sm:mx-0', 'sm:rounded-2xl', 'sm:border');
  });

  it('session notice를 제목 아래 form 내부에 배치한다', () => {
    renderLoginForm({
      sessionNotice: <div data-testid="session-notice">세션 안내</div>,
    });

    const notice = screen.getByTestId('session-notice');
    expect(notice.closest('form')).toBeInTheDocument();
    expect(
      screen.getByTestId('login-card-header').compareDocumentPosition(notice) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('route result notice도 제목 아래 form 내부에 배치한다', () => {
    renderLoginForm({
      routeNotice: <div data-testid="route-notice">결과 안내</div>,
    });

    const notice = screen.getByTestId('route-notice');
    expect(notice.closest('form')).toBeInTheDocument();
    expect(
      screen.getByTestId('login-card-header').compareDocumentPosition(notice) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoginForm } from '../LoginForm';
import type { LoginFormValues } from '../../model/login-form.types';

vi.mock('lucide-react', () => ({
  Lock: () => <span data-testid="icon-lock" />,
  AlertCircle: () => <span data-testid="icon-alert" />,
  Timer: () => <span data-testid="icon-timer" />,
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
        message: '로그인 시도가 5회 실패하여 계정이 5분간 잠겼습니다.',
        remainingSeconds: 300,
      },
      isLocked: true,
      isSubmitDisabled: true,
      cooldownLabel: '5:00',
    });

    expect(screen.getByText('비밀번호를 입력해주세요.')).toBeInTheDocument();
    expect(screen.getByText(/최대 7일 동안 다시 로그인하지 않아도 됩니다/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '계정 잠금 중' })).toBeDisabled();
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent('남은 시간: 5:00');
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
    expect(screen.getByLabelText('이메일')).toBeDisabled();
    expect(screen.getByLabelText('비밀번호')).toBeDisabled();
  });
});

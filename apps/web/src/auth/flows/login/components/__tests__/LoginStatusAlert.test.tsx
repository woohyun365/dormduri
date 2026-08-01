import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoginStatusAlert } from '../LoginStatusAlert';

vi.mock('lucide-react', () => ({
  AlertCircle: () => <span data-testid="icon-alert" />,
  CheckCircle: () => <span data-testid="icon-check-circle" />,
  Info: () => <span data-testid="icon-info" />,
  Timer: () => <span data-testid="icon-timer" />,
  WifiOff: () => <span data-testid="icon-wifi-off" />,
}));

describe('LoginStatusAlert', () => {
  it('error가 없으면 렌더링하지 않는다', () => {
    const { container } = render(<LoginStatusAlert error={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('invalid error를 alert로 표시한다', () => {
    render(
      <LoginStatusAlert
        error={{ status: 'invalid', message: '이메일 또는 비밀번호가 올바르지 않습니다.' }}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      '이메일 또는 비밀번호가 올바르지 않습니다.',
    );
    expect(screen.getByRole('alert')).toHaveAttribute('data-variant', 'error');
    expect(screen.getByTestId('icon-alert')).toBeInTheDocument();
  });

  it('locked/throttled 상태는 countdown label을 함께 표시한다', () => {
    render(
      <LoginStatusAlert
        error={{
          status: 'locked',
          message: '반복된 로그인 실패로 계정이 잠겼어요.',
          remainingSeconds: 300,
        }}
        cooldownLabel="5:00"
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('반복된 로그인 실패로 계정이 잠겼어요.');
    expect(screen.getByRole('timer')).toHaveTextContent('남은 시간: 5:00');
    expect(screen.getByRole('timer')).toHaveAttribute('aria-live', 'off');
    expect(screen.getByRole('timer')).toHaveAccessibleName('로그인 제한 남은 시간 5:00');
    expect(screen.getByRole('alert')).toHaveAttribute('data-variant', 'warning');
    expect(screen.getByTestId('icon-timer')).toBeInTheDocument();
  });

  it('network/server 오류는 connectivity strip으로 표시한다', () => {
    render(
      <LoginStatusAlert
        error={{ status: 'network-error', message: '잠시 연결이 원활하지 않아요.' }}
      />,
    );

    expect(screen.getByRole('alert')).toHaveAttribute('data-variant', 'connectivity');
    expect(screen.getByTestId('icon-wifi-off')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoginStatusAlert } from '../LoginStatusAlert';

vi.mock('lucide-react', () => ({
  AlertCircle: () => <span data-testid="icon-alert" />,
  Timer: () => <span data-testid="icon-timer" />,
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
    expect(screen.getByTestId('icon-alert')).toBeInTheDocument();
  });

  it('locked/throttled 상태는 countdown label을 함께 표시한다', () => {
    render(
      <LoginStatusAlert
        error={{
          status: 'locked',
          message: '로그인 시도가 5회 실패하여 계정이 5분간 잠겼습니다.',
          remainingSeconds: 300,
        }}
        cooldownLabel="5:00"
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('남은 시간: 5:00');
    expect(screen.getByTestId('icon-timer')).toBeInTheDocument();
  });
});

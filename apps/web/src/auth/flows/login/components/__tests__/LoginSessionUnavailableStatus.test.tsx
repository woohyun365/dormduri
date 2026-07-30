import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LoginSessionUnavailableStatus } from '../LoginSessionUnavailableStatus';

vi.mock('lucide-react', () => ({
  AlertCircle: () => <span data-testid="icon-alert" />,
  CheckCircle: () => <span data-testid="icon-check-circle" />,
  Timer: () => <span data-testid="icon-timer" />,
  WifiOff: () => <span data-testid="icon-wifi-off" />,
}));

describe('LoginSessionUnavailableStatus', () => {
  it('순간적인 session 확인 지연을 compact status strip으로 안내한다', async () => {
    const onRetryAction = vi.fn();
    const user = userEvent.setup();

    render(<LoginSessionUnavailableStatus onRetryAction={onRetryAction} />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('로그인 상태 확인이 잠시 늦어져요');
    expect(status).toHaveTextContent('로그인은 계속할 수 있어요.');
    expect(status).toHaveAttribute('data-variant', 'connectivity');
    expect(status).toHaveClass('border-l-2', 'bg-rose-50/80');
    expect(screen.getByTestId('icon-wifi-off')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다시 확인' }));
    expect(onRetryAction).toHaveBeenCalledTimes(1);
  });
});

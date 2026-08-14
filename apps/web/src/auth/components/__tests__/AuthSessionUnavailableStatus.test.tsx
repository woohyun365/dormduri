import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthSessionUnavailableStatus } from '../feedback/AuthSessionUnavailableStatus';

vi.mock('lucide-react', () => ({
  AlertCircle: () => <span data-testid="icon-alert" />,
  CheckCircle: () => <span data-testid="icon-check-circle" />,
  Info: () => <span data-testid="icon-info" />,
  Timer: () => <span data-testid="icon-timer" />,
  WifiOff: () => <span data-testid="icon-wifi-off" />,
}));

describe('AuthSessionUnavailableStatus', () => {
  it('순간적인 session 확인 지연을 compact status strip으로 안내한다', async () => {
    const onRetryAction = vi.fn();
    const user = userEvent.setup();

    render(
      <AuthSessionUnavailableStatus
        title="로그인 상태를 확인하지 못했어요"
        description="로그인은 그대로 진행할 수 있어요."
        onRetryAction={onRetryAction}
      />,
    );

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('로그인 상태를 확인하지 못했어요');
    expect(status).toHaveTextContent('로그인은 그대로 진행할 수 있어요.');
    expect(status).toHaveClass('border-slate-200', 'bg-slate-50');
    expect(screen.getByTestId('icon-wifi-off')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다시 확인' }));
    expect(onRetryAction).toHaveBeenCalledTimes(1);
  });
});

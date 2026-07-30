import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoginFeedbackStrip } from '../LoginFeedbackStrip';

vi.mock('lucide-react', () => ({
  AlertCircle: () => <span data-testid="icon-alert" />,
  CheckCircle: () => <span data-testid="icon-check-circle" />,
  Timer: () => <span data-testid="icon-timer" />,
  WifiOff: () => <span data-testid="icon-wifi-off" />,
}));

describe('LoginFeedbackStrip', () => {
  it('variant별 presentation과 접근성 role을 공통 구조로 제공한다', () => {
    render(
      <LoginFeedbackStrip
        variant="success"
        role="status"
        title="비밀번호가 변경되었어요"
        description="새 비밀번호로 로그인해 주세요."
      />,
    );

    const strip = screen.getByRole('status');
    expect(strip).toHaveAttribute('data-variant', 'success');
    expect(strip).toHaveTextContent('비밀번호가 변경되었어요');
    expect(strip).toHaveTextContent('새 비밀번호로 로그인해 주세요.');
    expect(strip).toHaveClass('border-l-2', 'rounded-r-xl');
    expect(screen.getByTestId('icon-check-circle')).toBeInTheDocument();
  });
});

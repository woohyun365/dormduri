import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthFeedbackStrip } from '../AuthFeedbackStrip';

vi.mock('lucide-react', () => ({
  AlertCircle: () => <span data-testid="icon-alert" />,
  CheckCircle: () => <span data-testid="icon-check-circle" />,
  Info: () => <span data-testid="icon-info" />,
  Timer: () => <span data-testid="icon-timer" />,
  WifiOff: () => <span data-testid="icon-wifi-off" />,
}));

describe('AuthFeedbackStrip', () => {
  it('인증 flow가 공유할 presentation과 접근성 role을 제공한다', () => {
    render(
      <AuthFeedbackStrip
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
    expect(screen.getByText('비밀번호가 변경되었어요')).toHaveClass('text-sm', 'leading-5');
    expect(screen.getByText('새 비밀번호로 로그인해 주세요.')).toHaveClass('text-xs', 'leading-5');
  });

  it('action별 보조 정보는 설명 우측에 배치한다', () => {
    render(
      <AuthFeedbackStrip
        variant="warning"
        title="잠시 후 다시 요청할 수 있어요"
        description="인증 코드 요청 가능까지"
        aside={<span role="timer">00:30</span>}
      />,
    );

    expect(screen.getByRole('timer')).toHaveTextContent('00:30');
    expect(screen.getByTestId('icon-timer')).toBeInTheDocument();
  });
});

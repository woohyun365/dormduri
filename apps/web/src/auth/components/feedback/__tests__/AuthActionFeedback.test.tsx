import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthActionFeedback } from '../AuthActionFeedback';

vi.mock('lucide-react', () => ({
  AlertCircle: () => <span data-testid="icon-alert" />,
  CheckCircle: () => <span data-testid="icon-check-circle" />,
  Info: () => <span data-testid="icon-info" />,
  Timer: () => <span data-testid="icon-timer" />,
  WifiOff: () => <span data-testid="icon-wifi-off" />,
}));

describe('AuthActionFeedback', () => {
  it('action 결과가 나타나면 안내 제목으로 초점과 스크롤을 이동한다', async () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    render(
      <AuthActionFeedback
        variant="connectivity"
        title="요청을 처리하지 못했어요"
        description="네트워크를 확인한 뒤 다시 시도해 주세요."
      />,
    );

    const title = screen.getByText('요청을 처리하지 못했어요');
    await waitFor(() => expect(title).toHaveFocus());
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });
});

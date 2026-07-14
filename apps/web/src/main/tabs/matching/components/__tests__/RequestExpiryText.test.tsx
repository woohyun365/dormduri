import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestExpiryText } from '../RequestExpiryText';

describe('RequestExpiryText', () => {
  afterEach(() => vi.useRealTimers());

  it('serverNow monotonic elapsed의 실제 label 경계에서만 갱신한다', async () => {
    vi.useFakeTimers();
    render(
      <RequestExpiryText
        serverNow="2026-08-01T00:00:00.000Z"
        expiresAt="2026-08-01T00:01:00.000Z"
        roomSelectionDate={null}
      />,
    );

    expect(screen.getByText('요청 만료까지 0시간 1분 남음')).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(1_000));
    expect(screen.getByText('요청 만료까지 0시간 0분 남음')).toBeInTheDocument();
  });

  it('매분 label 대신 임계 구간 메시지만 polite live region으로 제공한다', () => {
    render(
      <RequestExpiryText
        serverNow="2026-08-01T00:00:00.000Z"
        expiresAt="2026-08-01T00:30:00.000Z"
        roomSelectionDate={null}
      />,
    );

    const liveRegion = screen.getByText('요청 처리 기한이 1시간 이내로 남았어요.');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    expect(liveRegion).toHaveClass('sr-only');
    expect(screen.getByText('요청 만료까지 0시간 30분 남음')).not.toHaveAttribute('aria-live');
  });
});

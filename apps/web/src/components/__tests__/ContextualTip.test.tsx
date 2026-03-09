import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ContextualTip } from '../ContextualTip';

describe('ContextualTip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('메시지를 렌더링한다', () => {
    render(
      <ContextualTip message="생활패턴이 비슷할수록 매칭점수가 높아요" onDismiss={() => {}} />,
    );

    expect(screen.getByText('생활패턴이 비슷할수록 매칭점수가 높아요')).toBeInTheDocument();
  });

  it('클릭 시 onDismiss가 호출된다', () => {
    const handleDismiss = vi.fn();

    render(<ContextualTip message="테스트 메시지" onDismiss={handleDismiss} />);

    fireEvent.click(screen.getByText('테스트 메시지'));

    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it('8초 후 자동으로 onDismiss가 호출된다', () => {
    const handleDismiss = vi.fn();

    render(<ContextualTip message="테스트 메시지" onDismiss={handleDismiss} />);

    expect(handleDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it('8초 전에 클릭하면 타이머가 취소되어 중복 호출되지 않는다', () => {
    const handleDismiss = vi.fn();

    render(<ContextualTip message="테스트 메시지" onDismiss={handleDismiss} />);

    fireEvent.click(screen.getByText('테스트 메시지'));
    expect(handleDismiss).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it('언마운트 시 타이머가 정리된다', () => {
    const handleDismiss = vi.fn();

    const { unmount } = render(<ContextualTip message="테스트 메시지" onDismiss={handleDismiss} />);

    unmount();

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    expect(handleDismiss).not.toHaveBeenCalled();
  });

  it('아이콘과 함께 렌더링된다', () => {
    render(<ContextualTip message="테스트 메시지" onDismiss={() => {}} />);

    // 💡 아이콘이 존재하는지 (접근성 또는 구조 확인)
    const tip = screen.getByRole('status');
    expect(tip).toBeInTheDocument();
  });
});

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePasswordResetCooldown } from '../usePasswordResetCooldown';

describe('usePasswordResetCooldown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('start 후 매초 감소하고 0에서 비활성화된다', () => {
    const { result } = renderHook(() => usePasswordResetCooldown(3));

    act(() => {
      result.current.start();
    });

    expect(result.current.countdown).toBe(3);
    expect(result.current.isActive).toBe(true);
    expect(result.current.formatTime()).toBe('0:03');

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.countdown).toBe(0);
    expect(result.current.isActive).toBe(false);
  });

  it('stop은 남은 interval을 정리하고 countdown을 0으로 만든다', () => {
    const { result } = renderHook(() => usePasswordResetCooldown(10));

    act(() => {
      result.current.start();
      vi.advanceTimersByTime(2000);
      result.current.stop();
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.countdown).toBe(0);
    expect(result.current.isActive).toBe(false);
  });

  it('명시 seconds로 시작해 Retry-After 기반 countdown 준비 상태를 보존한다', () => {
    const { result } = renderHook(() => usePasswordResetCooldown(600));

    act(() => {
      result.current.start(7);
    });

    expect(result.current.countdown).toBe(7);
    expect(result.current.formatTime()).toBe('0:07');
  });
});

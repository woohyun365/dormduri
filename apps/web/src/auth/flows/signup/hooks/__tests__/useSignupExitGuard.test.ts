import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSignupExitGuard } from '../useSignupExitGuard';

describe('useSignupExitGuard', () => {
  it('작성 중 새로고침·browser exit은 beforeunload로 다시 확인한다', () => {
    const { unmount } = renderHook(() =>
      useSignupExitGuard({
        shouldWarn: true,
        onConfirmExit: vi.fn(),
      }),
    );
    const event = new Event('beforeunload', { cancelable: true });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    unmount();
  });

  it('작성 내용이 없으면 browser exit을 막지 않는다', () => {
    renderHook(() =>
      useSignupExitGuard({
        shouldWarn: false,
        onConfirmExit: vi.fn(),
      }),
    );
    const event = new Event('beforeunload', { cancelable: true });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('logo처럼 앱이 명시적으로 전달한 exit action은 제품 dialog에서 확인한다', () => {
    const onConfirmExit = vi.fn();
    const { result } = renderHook(() =>
      useSignupExitGuard({
        shouldWarn: true,
        onConfirmExit,
      }),
    );

    act(() => {
      expect(result.current.requestExit()).toBe(false);
    });
    expect(result.current.isExitDialogOpen).toBe(true);

    act(() => {
      result.current.confirmExit();
    });
    expect(onConfirmExit).toHaveBeenCalledTimes(1);
    expect(result.current.isExitDialogOpen).toBe(false);
  });
});

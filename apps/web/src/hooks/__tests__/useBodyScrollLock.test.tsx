import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBodyScrollLock } from '../useBodyScrollLock';

describe('useBodyScrollLock', () => {
  afterEach(() => {
    vi.clearAllMocks();
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('style');
  });

  it('open 동안 body/document scroll을 잠그고 fixed offset 없이 기존 inline style을 복원한다', () => {
    document.body.style.overflow = 'auto';
    document.body.style.position = 'relative';
    document.body.style.top = '1px';
    document.body.style.left = '2px';
    document.body.style.right = '3px';
    document.body.style.width = 'calc(100% - 4px)';
    document.documentElement.style.overflow = 'clip';
    const { unmount } = renderHook(() => useBodyScrollLock(true));

    expect(document.body.style.overflow).toBe('clip');
    expect(document.body.style.position).toBe('relative');
    expect(document.body.style.top).toBe('1px');
    expect(document.body.style.left).toBe('2px');
    expect(document.body.style.right).toBe('3px');
    expect(document.body.style.width).toBe('calc(100% - 4px)');
    expect(document.documentElement.style.overflow).toBe('clip');

    unmount();

    expect(document.body.style.overflow).toBe('auto');
    expect(document.body.style.position).toBe('relative');
    expect(document.body.style.top).toBe('1px');
    expect(document.body.style.left).toBe('2px');
    expect(document.body.style.right).toBe('3px');
    expect(document.body.style.width).toBe('calc(100% - 4px)');
    expect(document.documentElement.style.overflow).toBe('clip');
  });

  it('중첩 lock이 남아 있으면 먼저 unmount된 lock이 body scroll을 복원하지 않는다', () => {
    document.body.style.overflow = 'auto';
    const firstLock = renderHook(() => useBodyScrollLock(true));
    const secondLock = renderHook(() => useBodyScrollLock(true));

    firstLock.unmount();

    expect(document.body.style.overflow).toBe('clip');
    expect(document.body.style.position).toBe('');

    secondLock.unmount();

    expect(document.body.style.overflow).toBe('auto');
    expect(document.body.style.position).toBe('');
  });
});

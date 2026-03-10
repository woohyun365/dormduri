import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMainListViewState } from '../useMainListViewState';

describe('useMainListViewState', () => {
  it('초기 상태가 올바르다', () => {
    const { result } = renderHook(() => useMainListViewState());

    expect(result.current.sortMode).toBe('match');
    expect(result.current.viewMode).toBe('all');
    expect(result.current.showProfileBanner).toBe(true);
  });

  it('sortMode를 변경할 수 있다', () => {
    const { result } = renderHook(() => useMainListViewState());

    act(() => result.current.setSortMode('latest'));

    expect(result.current.sortMode).toBe('latest');
  });

  it('viewMode를 변경할 수 있다', () => {
    const { result } = renderHook(() => useMainListViewState());

    act(() => result.current.setViewMode('bookmarked'));

    expect(result.current.viewMode).toBe('bookmarked');
  });

  it('dismissProfileBanner로 배너를 숨길 수 있다', () => {
    const { result } = renderHook(() => useMainListViewState());

    expect(result.current.showProfileBanner).toBe(true);

    act(() => result.current.dismissProfileBanner());

    expect(result.current.showProfileBanner).toBe(false);
  });

  it('배너 dismiss 후 다른 상태 변경에도 유지된다', () => {
    const { result } = renderHook(() => useMainListViewState());

    act(() => result.current.dismissProfileBanner());
    act(() => result.current.setSortMode('latest'));

    expect(result.current.showProfileBanner).toBe(false);
    expect(result.current.sortMode).toBe('latest');
  });
});

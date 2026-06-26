import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMainLocalOnboardingState } from '../useMainLocalOnboardingState';

beforeEach(() => {
  localStorage.clear();
});

describe('useMainLocalOnboardingState — 건물 가이드', () => {
  it('건물 가이드 미확인 상태를 반환한다', () => {
    const { result } = renderHook(() => useMainLocalOnboardingState('user-1'));

    expect(result.current.hasSeenGuide('saerom')).toBe(false);
  });

  it('markGuideSeen 후 해당 건물이 확인 상태가 된다', () => {
    const { result } = renderHook(() => useMainLocalOnboardingState('user-1'));

    act(() => result.current.markGuideSeen('saerom'));

    expect(result.current.hasSeenGuide('saerom')).toBe(true);
    expect(result.current.hasSeenGuide('dasan')).toBe(false);
  });
});

describe('useMainLocalOnboardingState — 사용자별 키 분리', () => {
  it('다른 유저는 독립적인 상태를 가진다', () => {
    const { result: user1 } = renderHook(() => useMainLocalOnboardingState('user-1'));
    const { result: user2 } = renderHook(() => useMainLocalOnboardingState('user-2'));

    act(() => user1.current.markGuideSeen('saerom'));

    expect(user1.current.hasSeenGuide('saerom')).toBe(true);
    expect(user2.current.hasSeenGuide('saerom')).toBe(false);
  });

  it('같은 유저는 상태를 공유한다', () => {
    const { result: hook1 } = renderHook(() => useMainLocalOnboardingState('user-1'));

    act(() => hook1.current.markGuideSeen('saerom'));

    const { result: hook2 } = renderHook(() => useMainLocalOnboardingState('user-1'));
    expect(hook2.current.hasSeenGuide('saerom')).toBe(true);
  });
});

describe('useMainLocalOnboardingState — 툴팁', () => {
  it('초기 상태에서 툴팁은 미확인이다', () => {
    const { result } = renderHook(() => useMainLocalOnboardingState('user-1'));

    expect(result.current.hasSeenTooltip('profile-card')).toBe(false);
    expect(result.current.hasSeenTooltip('match-request')).toBe(false);
  });

  it('markTooltipSeen 후 해당 툴팁이 확인 상태가 된다', () => {
    const { result } = renderHook(() => useMainLocalOnboardingState('user-1'));

    act(() => result.current.markTooltipSeen('profile-card'));

    expect(result.current.hasSeenTooltip('profile-card')).toBe(true);
    expect(result.current.hasSeenTooltip('match-request')).toBe(false);
  });

  it('툴팁 상태가 localStorage에 영속된다', () => {
    const { result: hook1 } = renderHook(() => useMainLocalOnboardingState('user-1'));

    act(() => hook1.current.markTooltipSeen('profile-card'));

    const { result: hook2 } = renderHook(() => useMainLocalOnboardingState('user-1'));
    expect(hook2.current.hasSeenTooltip('profile-card')).toBe(true);
  });

  it('다른 유저의 툴팁 상태는 독립적이다', () => {
    const { result: user1 } = renderHook(() => useMainLocalOnboardingState('user-1'));

    act(() => user1.current.markTooltipSeen('profile-card'));

    const { result: user2 } = renderHook(() => useMainLocalOnboardingState('user-2'));
    expect(user2.current.hasSeenTooltip('profile-card')).toBe(false);
  });
});

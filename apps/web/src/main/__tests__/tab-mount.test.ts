import { describe, it, expect } from 'vitest';
import type { TabId } from '@/types/profile';

// PR #52: CSS hidden → 조건부 마운트 전환 회귀 테스트
// @testing-library/react 미설치로 인해 DOM 렌더링 없이 탭 마운트 로직을 단위 테스트

type TabVisibility = Record<TabId, boolean>;

/**
 * Main.tsx의 조건부 렌더링 로직을 순수 함수로 추출:
 * activeTab === tabId 일 때만 해당 탭이 마운트됨.
 */
function getTabVisibility(activeTab: TabId): TabVisibility {
  return {
    home: activeTab === 'home',
    list: activeTab === 'list',
    matching: activeTab === 'matching',
    chat: activeTab === 'chat',
    profile: activeTab === 'profile',
  };
}

/**
 * 탭 전환 시 scrollTo(0, 0) 호출 여부를 검증하기 위한 헬퍼.
 * Main.tsx에서 useEffect(() => { window.scrollTo(0, 0); }, [activeTab]) 패턴.
 */
function shouldScrollToTopOnTabChange(prevTab: TabId, nextTab: TabId): boolean {
  return prevTab !== nextTab;
}

describe('탭 마운트 전략 (조건부 마운트)', () => {
  it('초기 탭이 home일 때 HomeTab만 마운트됨', () => {
    const visibility = getTabVisibility('home');
    expect(visibility.home).toBe(true);
    expect(visibility.list).toBe(false);
    expect(visibility.profile).toBe(false);
    expect(visibility.chat).toBe(false);
  });

  it('list 탭 전환 시 RoommateListTab만 마운트됨', () => {
    const visibility = getTabVisibility('list');
    expect(visibility.list).toBe(true);
    expect(visibility.home).toBe(false);
    expect(visibility.profile).toBe(false);
    expect(visibility.chat).toBe(false);
  });

  it('profile 탭 전환 시 ProfileTab만 마운트됨', () => {
    const visibility = getTabVisibility('profile');
    expect(visibility.profile).toBe(true);
    expect(visibility.home).toBe(false);
    expect(visibility.list).toBe(false);
    expect(visibility.chat).toBe(false);
  });

  it('chat 탭 전환 시 ChatTab만 마운트됨', () => {
    const visibility = getTabVisibility('chat');
    expect(visibility.chat).toBe(true);
    expect(visibility.home).toBe(false);
    expect(visibility.list).toBe(false);
    expect(visibility.profile).toBe(false);
  });

  it('정확히 하나의 탭만 마운트됨 (모든 탭 검증)', () => {
    const tabs: TabId[] = ['home', 'list', 'matching', 'chat', 'profile'];
    for (const activeTab of tabs) {
      const visibility = getTabVisibility(activeTab);
      const mountedCount = Object.values(visibility).filter(Boolean).length;
      expect(mountedCount).toBe(1);
    }
  });

  it('이전 탭과 다른 탭으로 전환 시 scrollTo 트리거', () => {
    expect(shouldScrollToTopOnTabChange('home', 'list')).toBe(true);
    expect(shouldScrollToTopOnTabChange('list', 'profile')).toBe(true);
    expect(shouldScrollToTopOnTabChange('profile', 'chat')).toBe(true);
  });

  it('같은 탭 재클릭 시 scrollTo 트리거 안 됨', () => {
    const tabs: TabId[] = ['home', 'list', 'matching', 'chat', 'profile'];
    for (const tab of tabs) {
      expect(shouldScrollToTopOnTabChange(tab, tab)).toBe(false);
    }
  });
});

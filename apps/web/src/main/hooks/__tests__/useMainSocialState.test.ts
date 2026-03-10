import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMainSocialState } from '../useMainSocialState';

function setup() {
  const toasts: string[] = [];
  const showToast = (msg: string) => toasts.push(msg);
  const hook = renderHook(() => useMainSocialState(showToast));
  return { hook, toasts };
}

describe('useMainSocialState — 북마크', () => {
  it('초기 상태에서 북마크가 비어있다', () => {
    const { hook } = setup();
    expect(hook.result.current.bookmarkedUserIds.size).toBe(0);
  });

  it('토글로 북마크를 추가/제거할 수 있다', () => {
    const { hook } = setup();

    act(() => hook.result.current.handleToggleBookmark('user-1'));
    expect(hook.result.current.bookmarkedUserIds.has('user-1')).toBe(true);

    act(() => hook.result.current.handleToggleBookmark('user-1'));
    expect(hook.result.current.bookmarkedUserIds.has('user-1')).toBe(false);
  });
});

describe('useMainSocialState — 차단', () => {
  it('차단 시 blockedUsers에 추가된다', () => {
    const { hook, toasts } = setup();

    act(() => hook.result.current.handleBlockUser('user-1', '닉네임A'));

    expect(hook.result.current.blockedUserIds.has('user-1')).toBe(true);
    expect(hook.result.current.blockedUsers).toHaveLength(1);
    expect(toasts).toContain('닉네임A님을 차단했어요');
  });

  it('차단 시 북마크가 자동 제거된다', () => {
    const { hook } = setup();

    act(() => hook.result.current.handleToggleBookmark('user-1'));
    expect(hook.result.current.bookmarkedUserIds.has('user-1')).toBe(true);

    act(() => hook.result.current.handleBlockUser('user-1', '닉네임A'));
    expect(hook.result.current.bookmarkedUserIds.has('user-1')).toBe(false);
  });

  it('이미 차단된 유저를 중복 차단하지 않는다', () => {
    const { hook } = setup();

    act(() => hook.result.current.handleBlockUser('user-1', '닉네임A'));
    act(() => hook.result.current.handleBlockUser('user-1', '닉네임A'));

    expect(hook.result.current.blockedUsers).toHaveLength(1);
  });

  it('차단 해제 시 blockedUsers에서 제거된다', () => {
    const { hook, toasts } = setup();

    act(() => hook.result.current.handleBlockUser('user-1', '닉네임A'));
    act(() => hook.result.current.handleUnblockUser('user-1', '닉네임A'));

    expect(hook.result.current.blockedUserIds.has('user-1')).toBe(false);
    expect(hook.result.current.blockedUsers).toHaveLength(0);
    expect(toasts).toContain('닉네임A님의 차단을 해제했어요');
  });
});

describe('useMainSocialState — 신고', () => {
  it('신고 시 토스트가 표시된다', () => {
    const { hook, toasts } = setup();

    act(() => hook.result.current.handleReportUser('user-1', 'SPAM', null));

    expect(toasts).toContain('신고가 접수되었어요');
  });

  it('이미 신고한 유저를 중복 신고하면 안내 토스트가 표시된다', () => {
    const { hook, toasts } = setup();

    act(() => hook.result.current.handleReportUser('user-1', 'SPAM', null));
    act(() => hook.result.current.handleReportUser('user-1', 'OFFENSIVE', '상세'));

    expect(toasts.filter((t) => t === '이미 신고한 사용자예요')).toHaveLength(1);
  });
});

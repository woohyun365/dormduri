import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SERVICE_INTRO_NOTICE_KEY } from '@repo/shared/user';
import { createHomeDashboardTestResponse } from '@/main/test-support/home-dashboard.builder';
import { homeOnboardingNoticeApi } from '@/main/tabs/home/api/home-onboarding-notice.api';
import { isServiceIntroNoticeDismissed, useHomeOnboardingNotice } from '../useHomeOnboardingNotice';

vi.mock('@/main/tabs/home/api/home-onboarding-notice.api', () => ({
  homeOnboardingNoticeApi: {
    dismissServiceIntroNotice: vi.fn(),
  },
}));

describe('useHomeOnboardingNotice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('service-intro dismissed source는 dashboard/current-user dismissed notice다', () => {
    localStorage.setItem('onboarding:user-1', JSON.stringify({ serviceIntro: true }));

    const { result } = renderHook(() =>
      useHomeOnboardingNotice({ dashboard: createHomeDashboardTestResponse() }),
    );

    expect(result.current.isOpen).toBe(true);
  });

  it('account dismissed=true이면 localStorage와 무관하게 안내를 열지 않는다', () => {
    const dashboard = createHomeDashboardTestResponse({
      viewer: {
        ...createHomeDashboardTestResponse().viewer,
        onboarding: {
          dismissedNotices: [
            {
              noticeKey: SERVICE_INTRO_NOTICE_KEY,
              dismissed: true,
              dismissedAt: '2026-06-23T00:00:00.000Z',
            },
          ],
        },
      },
    });

    const { result } = renderHook(() => useHomeOnboardingNotice({ dashboard }));

    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.openManually();
    });

    expect(result.current.isOpen).toBe(true);
    expect(isServiceIntroNoticeDismissed(dashboard.viewer.onboarding.dismissedNotices)).toBe(true);
  });

  it('다시 보지 않기는 BFF mutation 성공 후 dashboard refetch callback을 호출한다', async () => {
    const onDismissed = vi.fn(async () => undefined);
    vi.mocked(homeOnboardingNoticeApi.dismissServiceIntroNotice).mockResolvedValue({} as never);
    const { result } = renderHook(() =>
      useHomeOnboardingNotice({ dashboard: createHomeDashboardTestResponse(), onDismissed }),
    );

    await act(async () => {
      await result.current.dismissPermanently();
    });

    expect(homeOnboardingNoticeApi.dismissServiceIntroNotice).toHaveBeenCalledWith();
    expect(onDismissed).toHaveBeenCalledOnce();
    expect(result.current.isOpen).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('오늘 하루 보지 않기는 로컬 자정 전까지 안내를 다시 열지 않는다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-26T12:00:00+09:00'));
    const dashboard = createHomeDashboardTestResponse();
    const { result, unmount } = renderHook(() => useHomeOnboardingNotice({ dashboard }));

    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.dismissForToday();
    });

    expect(result.current.isOpen).toBe(false);

    unmount();

    const remountedHook = renderHook(() => useHomeOnboardingNotice({ dashboard }));
    const remounted = remountedHook.result;

    expect(remounted.current.isOpen).toBe(false);

    act(() => {
      remounted.current.openManually();
    });

    expect(remounted.current.isOpen).toBe(true);

    remountedHook.unmount();
    vi.setSystemTime(new Date('2026-06-27T00:00:01+09:00'));

    const { result: nextDay } = renderHook(() => useHomeOnboardingNotice({ dashboard }));

    expect(nextDay.current.isOpen).toBe(true);
  });

  it('X 닫기는 sessionStorage 기준으로 현재 로그인 세션 동안 안내를 다시 열지 않는다', () => {
    const dashboard = createHomeDashboardTestResponse();
    const { result, unmount } = renderHook(() => useHomeOnboardingNotice({ dashboard }));

    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.dismissForSession();
    });

    expect(result.current.isOpen).toBe(false);

    unmount();

    const { result: remounted } = renderHook(() => useHomeOnboardingNotice({ dashboard }));

    expect(remounted.current.isOpen).toBe(false);

    sessionStorage.clear();

    const { result: nextSession } = renderHook(() => useHomeOnboardingNotice({ dashboard }));

    expect(nextSession.current.isOpen).toBe(true);
  });

  it('dismiss 저장 성공 후 dashboard refetch가 실패해도 저장 실패로 표시하지 않는다', async () => {
    const onDismissed = vi.fn(async () => {
      throw new Error('raw refetch stack');
    });
    vi.mocked(homeOnboardingNoticeApi.dismissServiceIntroNotice).mockResolvedValue({} as never);
    const { result } = renderHook(() =>
      useHomeOnboardingNotice({ dashboard: createHomeDashboardTestResponse(), onDismissed }),
    );

    await act(async () => {
      await result.current.dismissPermanently();
    });

    expect(homeOnboardingNoticeApi.dismissServiceIntroNotice).toHaveBeenCalledWith();
    expect(onDismissed).toHaveBeenCalledOnce();
    expect(result.current.isOpen).toBe(false);
    expect(result.current.dismissing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('dismiss 저장 실패 시 raw error 대신 사용자용 오류를 유지하고 sheet를 열어둔다', async () => {
    vi.mocked(homeOnboardingNoticeApi.dismissServiceIntroNotice).mockRejectedValue(
      new Error('raw stack'),
    );
    const { result } = renderHook(() =>
      useHomeOnboardingNotice({ dashboard: createHomeDashboardTestResponse() }),
    );

    await act(async () => {
      await result.current.dismissPermanently();
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.error).toBe(
      '안내 상태를 저장하지 못했어요. 잠시 후 다시 시도하거나 나중에 다시 닫아주세요.',
    );
    expect(result.current.error).not.toContain('raw stack');
  });
});

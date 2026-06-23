import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SERVICE_INTRO_NOTICE_KEY } from '@repo/shared/user';
import { createHomeDashboardFixture } from '@/__fixtures__/home-dashboard';
import { currentUserApi } from '@/api/current-user';
import { isServiceIntroNoticeDismissed, useHomeOnboardingNotice } from '../useHomeOnboardingNotice';

vi.mock('@/api/current-user', () => ({
  currentUserApi: {
    dismissOnboardingNotice: vi.fn(),
  },
}));

describe('useHomeOnboardingNotice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('service-intro dismissed source는 dashboard/current-user dismissed notice다', () => {
    localStorage.setItem('onboarding:user-1', JSON.stringify({ serviceIntro: true }));

    const { result } = renderHook(() =>
      useHomeOnboardingNotice({ dashboard: createHomeDashboardFixture() }),
    );

    expect(result.current.isOpen).toBe(true);
  });

  it('account dismissed=true이면 localStorage와 무관하게 안내를 열지 않는다', () => {
    const dashboard = createHomeDashboardFixture({
      viewer: {
        ...createHomeDashboardFixture().viewer,
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
    expect(isServiceIntroNoticeDismissed(dashboard.viewer.onboarding.dismissedNotices)).toBe(true);
  });

  it('다시 보지 않기는 BFF mutation 성공 후 dashboard refetch callback을 호출한다', async () => {
    const onDismissed = vi.fn(async () => undefined);
    vi.mocked(currentUserApi.dismissOnboardingNotice).mockResolvedValue({} as never);
    const { result } = renderHook(() =>
      useHomeOnboardingNotice({ dashboard: createHomeDashboardFixture(), onDismissed }),
    );

    await act(async () => {
      await result.current.dismissPermanently();
    });

    expect(currentUserApi.dismissOnboardingNotice).toHaveBeenCalledWith({
      noticeKey: SERVICE_INTRO_NOTICE_KEY,
    });
    expect(onDismissed).toHaveBeenCalledOnce();
    expect(result.current.isOpen).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('dismiss 저장 성공 후 dashboard refetch가 실패해도 저장 실패로 표시하지 않는다', async () => {
    const onDismissed = vi.fn(async () => {
      throw new Error('raw refetch stack');
    });
    vi.mocked(currentUserApi.dismissOnboardingNotice).mockResolvedValue({} as never);
    const { result } = renderHook(() =>
      useHomeOnboardingNotice({ dashboard: createHomeDashboardFixture(), onDismissed }),
    );

    await act(async () => {
      await result.current.dismissPermanently();
    });

    expect(currentUserApi.dismissOnboardingNotice).toHaveBeenCalledWith({
      noticeKey: SERVICE_INTRO_NOTICE_KEY,
    });
    expect(onDismissed).toHaveBeenCalledOnce();
    expect(result.current.isOpen).toBe(false);
    expect(result.current.dismissing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('dismiss 저장 실패 시 raw error 대신 사용자용 오류를 유지하고 sheet를 열어둔다', async () => {
    vi.mocked(currentUserApi.dismissOnboardingNotice).mockRejectedValue(new Error('raw stack'));
    const { result } = renderHook(() =>
      useHomeOnboardingNotice({ dashboard: createHomeDashboardFixture() }),
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

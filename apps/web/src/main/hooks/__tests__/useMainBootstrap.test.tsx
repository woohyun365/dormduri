import { renderHook, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { profileApi } from '@/api/profile';
import { useMainBootstrap } from '../useMainBootstrap';
import type { UserProfile } from '@/types/profile';

vi.mock('@/api/profile', () => ({
  profileApi: {
    getMyProfile: vi.fn(),
  },
}));

const mockGetMyProfile = vi.mocked(profileApi.getMyProfile);

const profile = {
  id: 'profile-user-1',
  nickname: '프로필유저',
  gender: 'F',
  campus: 'CHUNCHEON',
  dormitoryId: 'saerom',
  lifestyle: {
    bedtime: null,
    wakeTime: null,
    sleepHabit: null,
    sleepEnvironment: null,
    screenUsage: null,
    noiseSensitivity: null,
    smokingBehavior: null,
    indoorEating: null,
    phoneBehavior: null,
    earphoneUsage: null,
    cleanLevel: null,
    drinkingFrequency: null,
    relationshipStyle: null,
    temperatureSensitivity: null,
    smokingTolerance: null,
    phoneTolerance: null,
    earphoneExpectation: null,
    sleepEnvPreference: null,
    screenTolerance: null,
    indoorEatingTolerance: null,
    cleanExpectation: null,
    drinkingTolerance: null,
  },
  intro: '프로필 API 소개',
  messageToRoommate: null,
  additional: { college: null, grade: null, mbti: null, birthYear: null },
} satisfies UserProfile;

describe('useMainBootstrap', () => {
  beforeEach(() => {
    mockGetMyProfile.mockReset();
  });

  it('session gate가 비활성화되면 profile API를 호출하지 않고 idle 상태를 반환한다', () => {
    const { result } = renderHook(() => useMainBootstrap({ enabled: false, sessionUserId: null }));

    expect(result.current.status).toBe('idle');
    expect(result.current.profile).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(mockGetMyProfile).not.toHaveBeenCalled();
  });

  it('session이 확인되면 profile API 결과를 Main profile로 반환한다', async () => {
    mockGetMyProfile.mockResolvedValue(profile);

    const { result } = renderHook(() =>
      useMainBootstrap({ enabled: true, sessionUserId: 'user-1' }),
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.profile).toEqual(profile);
    expect(mockGetMyProfile).toHaveBeenCalledTimes(1);
  });

  it('profile API가 null을 반환하면 auth 성공과 profile incomplete를 구분한다', async () => {
    mockGetMyProfile.mockResolvedValue(null);

    const { result } = renderHook(() =>
      useMainBootstrap({ enabled: true, sessionUserId: 'user-1' }),
    );

    await waitFor(() => expect(result.current.status).toBe('profile-incomplete'));

    expect(result.current.profile).toBeNull();
  });

  it('profile API 실패는 error 상태로 수렴하고 retry로 재조회할 수 있다', async () => {
    mockGetMyProfile
      .mockRejectedValueOnce(new Error('raw upstream stack'))
      .mockResolvedValue(profile);

    const { result } = renderHook(() =>
      useMainBootstrap({ enabled: true, sessionUserId: 'user-1' }),
    );

    await waitFor(() => expect(result.current.status).toBe('error'));

    act(() => {
      result.current.retry();
    });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.profile).toEqual(profile);
    expect(mockGetMyProfile).toHaveBeenCalledTimes(2);
  });
});

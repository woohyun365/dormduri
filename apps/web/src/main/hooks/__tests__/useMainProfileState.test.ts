import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMainProfileState } from '../useMainProfileState';
import type { UserProfile } from '@/main/model/profile';

const baseLifestyle: UserProfile['lifestyle'] = {
  bedtime: '22_24',
  wakeTime: '07_08',
  sleepHabit: 'NONE',
  sleepEnvironment: 'QUIET',
  screenUsage: 'NONE',
  noiseSensitivity: 'NORMAL',
  smokingBehavior: 'NO',
  indoorEating: 'SNACK',
  phoneBehavior: 'SOMETIMES',
  earphoneUsage: 'MOSTLY',
  cleanLevel: 'WEEKLY_1_2',
  drinkingFrequency: 'SOMETIMES',
  relationshipStyle: 'CASUAL',
  temperatureSensitivity: 'NORMAL',
  smokingTolerance: 'E_CIG_OK',
  phoneTolerance: 'BRIEF_OK',
  earphoneExpectation: 'LOW_VOLUME_OK',
  sleepEnvPreference: 'SPEAKER_OK',
  screenTolerance: 'SCREEN_OK',
  indoorEatingTolerance: 'CLEAN_OK',
  cleanExpectation: 'BASIC',
  drinkingTolerance: 'LOW_ONLY',
};

const baseAdditional: UserProfile['additional'] = {
  college: null,
  grade: null,
  mbti: null,
  birthYear: null,
};

const dormitories = [
  { id: 'dasan', name: '다산관', roomType: 2, genderPolicy: 'M' },
  { id: 'saerom', name: '새롬관', roomType: 2, genderPolicy: 'BOTH' },
] as const;

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'test-user-0001',
    nickname: '테스트',
    gender: 'M',
    campus: 'CHUNCHEON',
    dormitoryId: 'dasan',
    lifestyle: baseLifestyle,
    intro: '',
    messageToRoommate: null,
    additional: baseAdditional,
    ...overrides,
  };
}

function setup(userOverrides: Partial<UserProfile> = {}) {
  const toasts: string[] = [];
  const showToast = (msg: string) => toasts.push(msg);
  const initialUser = makeUser(userOverrides);

  const hook = renderHook(() =>
    useMainProfileState(initialUser, {
      showToast,
      dormitories,
    }),
  );

  return { hook, toasts };
}

describe('useMainProfileState — 건물 선택', () => {
  it('건물 선택 시 user.dormitoryId가 변경된다', () => {
    const { hook, toasts } = setup({ dormitoryId: null });

    act(() => hook.result.current.handleSelectDormitory('saerom'));

    expect(hook.result.current.user.dormitoryId).toBe('saerom');
    expect(toasts.some((t) => t.includes('새롬관'))).toBe(true);
  });

  it('미배정 선택 시 안내 토스트가 표시된다', () => {
    const { hook, toasts } = setup();

    act(() => hook.result.current.handleSelectDormitory(null));

    expect(hook.result.current.user.dormitoryId).toBeNull();
    expect(toasts).toContain('건물 미배정으로 설정했어요');
  });
});

describe('useMainProfileState — 프로필 편집', () => {
  it('자기소개 변경 시 토스트가 표시된다', () => {
    const { hook, toasts } = setup();

    act(() => hook.result.current.handleIntroChange('안녕하세요'));

    expect(hook.result.current.user.intro).toBe('안녕하세요');
    expect(toasts).toContain('자기소개가 저장되었어요');
  });

  it('생활패턴 변경 시 토스트가 표시된다', () => {
    const { hook, toasts } = setup();
    const newLifestyle = { ...baseLifestyle, smokingBehavior: 'YES' as const };

    act(() => hook.result.current.handleLifestyleChange(newLifestyle));

    expect(hook.result.current.user.lifestyle.smokingBehavior).toBe('YES');
    expect(toasts).toContain('생활패턴이 저장되었어요');
  });

  it('추가정보 변경 시 user에 반영된다', () => {
    const { hook } = setup();
    const newAdditional = { ...baseAdditional, college: 'CHUNCHEON_IT' as const };

    act(() => hook.result.current.handleAdditionalChange(newAdditional));

    expect(hook.result.current.user.additional.college).toBe('CHUNCHEON_IT');
  });
});

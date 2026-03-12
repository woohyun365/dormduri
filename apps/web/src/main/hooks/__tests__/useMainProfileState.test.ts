import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMainProfileState } from '../useMainProfileState';
import type { UserProfile } from '@/types/profile';

// mock-db dynamic import를 무시
vi.mock('@/__fixtures__/mock-db', () => ({
  mockDb: {
    getCurrentUser: () => null,
    updateUser: vi.fn(),
  },
}));

const baseLifestyle: UserProfile['lifestyle'] = {
  smoker: 'NO',
  sleepHabit: 'NONE',
  indoorEating: 'NO',
  bedtime: '22_24',
  wakeTime: '06_08',
  noiseSensitivity: 'MID',
  cleanliness: 'MID',
  relationshipStyle: 'CASUAL',
};

const baseAdditional: UserProfile['additional'] = {
  college: null,
  grade: null,
  mbti: null,
  temperatureSensitivity: null,
};

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
  const seenGuides = new Set<string>();
  const hasSeenGuide = (id: string) => seenGuides.has(id);
  const markGuideSeen = (id: string) => seenGuides.add(id);
  const initialUser = makeUser(userOverrides);

  const hook = renderHook(() =>
    useMainProfileState(initialUser, { showToast, hasSeenGuide, markGuideSeen }),
  );

  return { hook, toasts, seenGuides };
}

beforeEach(() => {
  vi.useFakeTimers();
});

describe('useMainProfileState — 건물 선택', () => {
  it('건물 선택 시 user.dormitoryId가 변경된다', () => {
    const { hook, toasts } = setup({ dormitoryId: null });

    act(() => hook.result.current.handleSelectDormitory('saerom'));

    expect(hook.result.current.user.dormitoryId).toBe('saerom');
    expect(toasts.some((t) => t.includes('새롬관'))).toBe(true);
  });

  it('미배정 선택 시 안내 토스트가 표시된다', () => {
    const { hook, toasts } = setup();

    act(() => hook.result.current.handleSelectDormitory('unassigned'));

    expect(hook.result.current.user.dormitoryId).toBe('unassigned');
    expect(toasts).toContain('건물 미배정으로 설정했어요');
  });

  it('미확인 건물 선택 시 가이드가 자동 표시된다', () => {
    const { hook } = setup();

    act(() => hook.result.current.handleSelectDormitory('saerom'));
    expect(hook.result.current.showGuide).toBe(false);

    act(() => vi.advanceTimersByTime(700));
    expect(hook.result.current.showGuide).toBe(true);
  });
});

describe('useMainProfileState — 가이드', () => {
  it('handleShowGuide로 가이드를 열 수 있다', () => {
    const { hook } = setup();

    act(() => hook.result.current.handleShowGuide());
    expect(hook.result.current.showGuide).toBe(true);
  });

  it('handleCloseGuide로 가이드를 닫고 markGuideSeen이 호출된다', () => {
    const { hook, seenGuides } = setup({ dormitoryId: 'dasan' });

    act(() => hook.result.current.handleShowGuide());
    act(() => hook.result.current.handleCloseGuide());

    expect(hook.result.current.showGuide).toBe(false);
    expect(seenGuides.has('dasan')).toBe(true);
  });
});

describe('useMainProfileState — 프로필 편집', () => {
  it('자기소개 변경 시 토스트가 표시된다', () => {
    const { hook, toasts } = setup();

    act(() => hook.result.current.handleIntroChange('안녕하세요'));

    expect(hook.result.current.user.intro).toBe('안녕하세요');
    expect(toasts).toContain('자기소개가 저장되었어요');
  });

  it('룸메 메시지 변경 시 토스트가 표시된다', () => {
    const { hook, toasts } = setup();

    act(() => hook.result.current.handleMessageChange('잘 부탁드려요'));

    expect(hook.result.current.user.messageToRoommate).toBe('잘 부탁드려요');
    expect(toasts).toContain('룸메에게 한마디가 저장되었어요');
  });

  it('생활패턴 변경 시 토스트가 표시된다', () => {
    const { hook, toasts } = setup();
    const newLifestyle = { ...baseLifestyle, smoker: 'YES' as const };

    act(() => hook.result.current.handleLifestyleChange(newLifestyle));

    expect(hook.result.current.user.lifestyle.smoker).toBe('YES');
    expect(toasts).toContain('생활패턴이 저장되었어요');
  });

  it('추가정보 변경 시 user에 반영된다', () => {
    const { hook } = setup();
    const newAdditional = { ...baseAdditional, college: 'IT대' as const };

    act(() => hook.result.current.handleAdditionalChange(newAdditional));

    expect(hook.result.current.user.additional.college).toBe('IT대');
  });
});

describe('useMainProfileState — 프로필 100% 완성 토스트', () => {
  it('모든 optional 필드 완성 시 축하 토스트가 1회만 표시된다', () => {
    const { hook, toasts } = setup();

    const completeAdditional: UserProfile['additional'] = {
      college: 'IT대',
      grade: '1',
      mbti: 'INTJ',
      temperatureSensitivity: 'NORMAL',
    };

    act(() => hook.result.current.handleMessageChange('메시지'));
    act(() => hook.result.current.handleAdditionalChange(completeAdditional));

    const completionToasts = toasts.filter((t) => t.includes('프로필이 완성'));
    expect(completionToasts).toHaveLength(1);

    // 추가 변경해도 다시 표시되지 않음
    act(() => hook.result.current.handleIntroChange('변경된 소개'));
    const afterToasts = toasts.filter((t) => t.includes('프로필이 완성'));
    expect(afterToasts).toHaveLength(1);
  });

  it('마운트 시 이미 완성된 상태면 토스트가 표시되지 않는다', () => {
    const { hook, toasts } = setup({
      messageToRoommate: '이미 있음',
      additional: {
        college: 'IT대',
        grade: '1',
        mbti: 'INTJ',
        temperatureSensitivity: 'NORMAL',
      },
    });

    // 변경해도 이미 완성 상태였으므로 토스트 없음
    act(() => hook.result.current.handleIntroChange('변경'));
    const completionToasts = toasts.filter((t) => t.includes('프로필이 완성'));
    expect(completionToasts).toHaveLength(0);
  });
});

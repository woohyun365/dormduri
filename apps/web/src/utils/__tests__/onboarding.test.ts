import { describe, it, expect } from 'vitest';
import { getChecklistItems, isChecklistComplete } from '../onboarding';
import type { UserProfile } from '@/types/profile';
import type { LifestyleData } from '@/types/lifestyle';

/** 최소 유저 프로필 생성 헬퍼 */
function createUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'test-user',
    email: 'test@kangwon.ac.kr',
    nickname: '테스트',
    gender: 'M',
    dormitoryId: null,
    intro: '',
    messageToRoommate: null,
    lifestyle: {
      bedtime: null,
      wakeTime: null,
      sleepHabit: null,
      sleepEnvironment: null,
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
      cleanExpectation: null,
      drinkingTolerance: null,
    },
    additional: {
      college: null,
      grade: null,
      mbti: null,
      birthYear: null,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as UserProfile;
}

describe('getChecklistItems', () => {
  it('모든 항목이 미완료인 초기 상태를 반환한다', () => {
    const user = createUser();
    const items = getChecklistItems(user, new Set());

    expect(items).toHaveLength(4);
    expect(items[0]).toMatchObject({ id: 'building', completed: false });
    expect(items[1]).toMatchObject({ id: 'lifestyle', completed: false });
    expect(items[2]).toMatchObject({ id: 'intro', completed: false });
    expect(items[3]).toMatchObject({ id: 'bookmark', completed: false });
  });

  it('건물이 선택되면 건물 항목이 완료된다', () => {
    const user = createUser({ dormitoryId: 'saerom' });
    const items = getChecklistItems(user, new Set());

    expect(items[0]).toMatchObject({ id: 'building', completed: true });
  });

  it('미배정(UNASSIGNED_ID)은 건물 선택 미완료이다', () => {
    const user = createUser({ dormitoryId: 'unassigned' });
    const items = getChecklistItems(user, new Set());

    expect(items[0]).toMatchObject({ id: 'building', completed: false });
  });

  it('생활패턴이 모두 입력되면 생활패턴 항목이 완료된다', () => {
    const lifestyle: LifestyleData = {
      bedtime: '22_24',
      wakeTime: '07_08',
      sleepHabit: 'NONE',
      sleepEnvironment: 'QUIET',
      noiseSensitivity: 'NORMAL',
      smokingBehavior: 'NO',
      indoorEating: 'OK',
      phoneBehavior: 'BRIEF',
      earphoneUsage: 'STUDY',
      cleanLevel: 'WEEKLY_1_2',
      drinkingFrequency: 'SOMETIMES',
      relationshipStyle: 'CASUAL',
      temperatureSensitivity: 'NORMAL',
      smokingTolerance: 'E_CIG_OK',
      phoneTolerance: 'BRIEF_OK',
      earphoneExpectation: 'STUDY',
      sleepEnvPreference: 'EARPHONE_OK',
      cleanExpectation: 'BASIC',
      drinkingTolerance: 'SOMETIMES_OK',
    };
    const user = createUser({ lifestyle });
    const items = getChecklistItems(user, new Set());

    expect(items[1]).toMatchObject({ id: 'lifestyle', completed: true });
  });

  it('생활패턴이 일부만 입력되면 미완료이다', () => {
    const user = createUser({
      lifestyle: {
        bedtime: '22_24',
        wakeTime: null,
        sleepHabit: null,
        sleepEnvironment: null,
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
        cleanExpectation: null,
        drinkingTolerance: null,
      },
    });
    const items = getChecklistItems(user, new Set());

    expect(items[1]).toMatchObject({ id: 'lifestyle', completed: false });
  });

  it('자기소개가 입력되면 자기소개 항목이 완료된다', () => {
    const user = createUser({ intro: '안녕하세요' });
    const items = getChecklistItems(user, new Set());

    expect(items[2]).toMatchObject({ id: 'intro', completed: true });
  });

  it('빈 문자열 자기소개는 미완료이다', () => {
    const user = createUser({ intro: '' });
    const items = getChecklistItems(user, new Set());

    expect(items[2]).toMatchObject({ id: 'intro', completed: false });
  });

  it('북마크가 있으면 북마크 항목이 완료된다', () => {
    const user = createUser();
    const items = getChecklistItems(user, new Set(['user-1']));

    expect(items[3]).toMatchObject({ id: 'bookmark', completed: true });
  });

  it('각 항목에 label과 navigateTo가 포함된다', () => {
    const user = createUser();
    const items = getChecklistItems(user, new Set());

    expect(items[0]).toMatchObject({ label: '건물 선택하기', navigateTo: 'building' });
    expect(items[1]).toMatchObject({ label: '생활패턴 입력하기', navigateTo: 'profile' });
    expect(items[2]).toMatchObject({ label: '자기소개 작성하기', navigateTo: 'profile' });
    expect(items[3]).toMatchObject({ label: '첫 룸메이트 찜하기', navigateTo: 'list' });
  });
});

describe('isChecklistComplete', () => {
  it('모든 항목 미완료 시 false를 반환한다', () => {
    const user = createUser();
    expect(isChecklistComplete(user, new Set())).toBe(false);
  });

  it('일부 항목만 완료 시 false를 반환한다', () => {
    const user = createUser({ dormitoryId: 'saerom', intro: '안녕' });
    expect(isChecklistComplete(user, new Set())).toBe(false);
  });

  it('모든 항목 완료 시 true를 반환한다', () => {
    const lifestyle: LifestyleData = {
      bedtime: '22_24',
      wakeTime: '07_08',
      sleepHabit: 'NONE',
      sleepEnvironment: 'QUIET',
      noiseSensitivity: 'NORMAL',
      smokingBehavior: 'NO',
      indoorEating: 'OK',
      phoneBehavior: 'BRIEF',
      earphoneUsage: 'STUDY',
      cleanLevel: 'WEEKLY_1_2',
      drinkingFrequency: 'SOMETIMES',
      relationshipStyle: 'CASUAL',
      temperatureSensitivity: 'NORMAL',
      smokingTolerance: 'E_CIG_OK',
      phoneTolerance: 'BRIEF_OK',
      earphoneExpectation: 'STUDY',
      sleepEnvPreference: 'EARPHONE_OK',
      cleanExpectation: 'BASIC',
      drinkingTolerance: 'SOMETIMES_OK',
    };
    const user = createUser({
      dormitoryId: 'saerom',
      intro: '안녕하세요',
      lifestyle,
    });
    expect(isChecklistComplete(user, new Set(['user-1']))).toBe(true);
  });
});

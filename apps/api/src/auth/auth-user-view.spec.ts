import { toAuthProfileSnapshot, toUserProfileBridge } from './auth-user-view.js';

describe('auth user view boundary', () => {
  const baseUser = {
    id: 'user-1',
    email: 'test@kangwon.ac.kr',
    nickname: '테스터',
    gender: 'M' as const,
    campus: 'CHUNCHEON' as const,
    lifestyle: {
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
      cleanLevel: 'WEEKLY_3_UP',
      drinkingFrequency: 'NONE',
      relationshipStyle: 'CLOSE',
      temperatureSensitivity: 'NORMAL',
      smokingTolerance: null,
      phoneTolerance: null,
      earphoneExpectation: null,
      sleepEnvPreference: null,
      screenTolerance: null,
      indoorEatingTolerance: null,
      cleanExpectation: null,
      drinkingTolerance: 'LOW_ONLY',
    },
    intro: '안녕하세요',
    dormitoryId: null,
    dormitorySelectionState: 'NOT_SELECTED' as const,
  };

  it('profile snapshot은 explicit dormitory selection state를 유지한다', () => {
    expect(toAuthProfileSnapshot(baseUser)).toMatchObject({
      dormitoryId: null,
      dormitorySelectionState: 'NOT_SELECTED',
    });
  });

  it('UNASSIGNED는 public bridge에서 sentinel dormitoryId로 변환한다', () => {
    const snapshot = toAuthProfileSnapshot({
      ...baseUser,
      dormitorySelectionState: 'UNASSIGNED',
    });

    expect(toUserProfileBridge(snapshot)).toMatchObject({
      dormitoryId: 'unassigned',
    });
  });

  it('ASSIGNED는 public bridge에서 실제 dormitoryId를 유지한다', () => {
    const snapshot = toAuthProfileSnapshot({
      ...baseUser,
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
    });

    expect(toUserProfileBridge(snapshot)).toMatchObject({
      dormitoryId: 'dasan',
    });
  });

  it('잘못된 lifestyle payload는 snapshot 생성 시 즉시 거부한다', () => {
    expect(() =>
      toAuthProfileSnapshot({
        ...baseUser,
        lifestyle: { bedtime: 'INVALID' },
      }),
    ).toThrow('[auth-user-view] invalid lifestyle payload from persistence layer');
  });
});

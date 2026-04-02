import { validateLifestyleData } from './lifestyle.schema.js';

const validLifestyle = {
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
};

describe('validateLifestyleData', () => {
  it('정책에 맞는 lifestyle payload를 통과시킨다', () => {
    const result = validateLifestyleData(validLifestyle);

    expect(result.ok).toBe(true);
  });

  it('필수 필드가 null이면 거부한다', () => {
    const result = validateLifestyleData({
      ...validLifestyle,
      bedtime: null,
    });

    expect(result).toEqual({
      ok: false,
      error: 'bedtime 필드는 필수입니다.',
    });
  });

  it('정의되지 않은 enum 값을 거부한다', () => {
    const result = validateLifestyleData({
      ...validLifestyle,
      wakeTime: 'MIDNIGHT',
    });

    expect(result).toEqual({
      ok: false,
      error: 'wakeTime 값이 정책에 정의된 enum 범위를 벗어났습니다.',
    });
  });

  it('정책에 없는 추가 키를 거부한다', () => {
    const result = validateLifestyleData({
      ...validLifestyle,
      debugOnly: true,
    });

    expect(result).toEqual({
      ok: false,
      error: '알 수 없는 생활패턴 필드가 포함되어 있습니다: debugOnly',
    });
  });

  it('screenUsage가 NONE이면 sleepEnvironment는 QUIET만 허용한다', () => {
    const result = validateLifestyleData({
      ...validLifestyle,
      screenUsage: 'NONE',
      sleepEnvironment: 'EARPHONE',
    });

    expect(result).toEqual({
      ok: false,
      error: 'screenUsage가 NONE일 때 sleepEnvironment는 QUIET이어야 합니다.',
    });
  });
});

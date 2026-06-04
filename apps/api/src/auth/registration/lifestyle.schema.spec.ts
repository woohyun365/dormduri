import { validateLifestyleData } from './lifestyle.schema.js';
// @ts-expect-error -- seed fixture is plain JS and intentionally reused here for schema compatibility regression coverage
import { AUTH_FIXTURE_USERS } from '../../../prisma/seed-data/fixtures/auth-fixture-users.js';

const fixtureUsers = AUTH_FIXTURE_USERS as unknown as ReadonlyArray<{
  key: string;
  lifestyle: Record<string, unknown>;
}>;

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

  it('lifestyle parser는 completeness 판정과 분리되어 생활패턴/조건 필수값 null을 parse 단계에서 허용한다', () => {
    const result = validateLifestyleData({
      ...validLifestyle,
      bedtime: null,
      drinkingTolerance: null,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        ...validLifestyle,
        bedtime: null,
        drinkingTolerance: null,
      },
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

  it('문서화된 auth fixture users의 lifestyle은 현재 schema를 모두 통과한다', () => {
    for (const fixtureUser of fixtureUsers) {
      const result = validateLifestyleData(fixtureUser.lifestyle);

      expect(result).toEqual({ ok: true, value: fixtureUser.lifestyle });
    }
  });
});

import { describe, it, expect } from 'vitest';
import { buildMainBuildingStats } from '../buildMainBuildingStats';
import type { UserProfile } from '@/types/profile';
import type { RoommateProfile } from '@/types/profile';

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

function makeProfile(
  overrides: Partial<Omit<RoommateProfile, 'matchScore'>> = {},
): Omit<RoommateProfile, 'matchScore'> {
  return {
    id: `p-${Math.random().toString(36).slice(2, 6)}`,
    nickname: '프로필',
    gender: 'M',
    dormitoryId: 'dasan',
    lifestyle: baseLifestyle,
    intro: '',
    messageToRoommate: null,
    additional: baseAdditional,
    ...overrides,
  };
}

describe('buildMainBuildingStats', () => {
  it('건물 미배정(null) 시 undefined를 반환한다', () => {
    const user = makeUser({ dormitoryId: null });
    expect(buildMainBuildingStats(user, [])).toBeUndefined();
  });

  it('건물 미배정(unassigned) 시 undefined를 반환한다', () => {
    const user = makeUser({ dormitoryId: 'unassigned' });
    expect(buildMainBuildingStats(user, [])).toBeUndefined();
  });

  it('같은 건물 프로필만 집계한다', () => {
    const user = makeUser({ dormitoryId: 'dasan' });
    const profiles = [
      makeProfile({ dormitoryId: 'dasan', gender: 'M' }),
      makeProfile({ dormitoryId: 'dasan', gender: 'M' }),
      makeProfile({ dormitoryId: 'saerom', gender: 'M' }),
    ];
    const result = buildMainBuildingStats(user, profiles);
    expect(result?.activeUsers).toBe(2);
  });

  it('같은 성별만 matchableUsers로 집계한다', () => {
    const user = makeUser({ dormitoryId: 'saerom', gender: 'M' });
    const profiles = [
      makeProfile({ dormitoryId: 'saerom', gender: 'M' }),
      makeProfile({ dormitoryId: 'saerom', gender: 'F' }),
      makeProfile({ dormitoryId: 'saerom', gender: 'M' }),
    ];
    const result = buildMainBuildingStats(user, profiles);
    expect(result?.activeUsers).toBe(3);
    expect(result?.matchableUsers).toBe(2);
  });

  it('비흡연이 과반이면 popularCondition에 포함된다', () => {
    const user = makeUser({ dormitoryId: 'dasan' });
    const profiles = [
      makeProfile({ dormitoryId: 'dasan', lifestyle: { ...baseLifestyle, smoker: 'NO' } }),
      makeProfile({ dormitoryId: 'dasan', lifestyle: { ...baseLifestyle, smoker: 'NO' } }),
      makeProfile({ dormitoryId: 'dasan', lifestyle: { ...baseLifestyle, smoker: 'YES' } }),
    ];
    const result = buildMainBuildingStats(user, profiles);
    expect(result?.popularCondition).toContain('비흡연');
  });

  it('24시 이전 취침이 과반이면 popularCondition에 포함된다', () => {
    const user = makeUser({ dormitoryId: 'dasan' });
    const profiles = [
      makeProfile({ dormitoryId: 'dasan', lifestyle: { ...baseLifestyle, bedtime: 'BEFORE_22' } }),
      makeProfile({ dormitoryId: 'dasan', lifestyle: { ...baseLifestyle, bedtime: '22_24' } }),
      makeProfile({ dormitoryId: 'dasan', lifestyle: { ...baseLifestyle, bedtime: 'AFTER_02' } }),
    ];
    const result = buildMainBuildingStats(user, profiles);
    expect(result?.popularCondition).toContain('24시 이전 취침');
  });

  it('조건을 충족하지 않으면 popularCondition이 "-"이다', () => {
    const user = makeUser({ dormitoryId: 'dasan' });
    const profiles = [
      makeProfile({
        dormitoryId: 'dasan',
        lifestyle: { ...baseLifestyle, smoker: 'YES', bedtime: 'AFTER_02' },
      }),
      makeProfile({
        dormitoryId: 'dasan',
        lifestyle: { ...baseLifestyle, smoker: 'YES', bedtime: 'AFTER_02' },
      }),
    ];
    const result = buildMainBuildingStats(user, profiles);
    expect(result?.popularCondition).toBe('-');
  });

  it('같은 건물 프로필이 없으면 activeUsers가 0이다', () => {
    const user = makeUser({ dormitoryId: 'dasan' });
    const result = buildMainBuildingStats(user, []);
    expect(result?.activeUsers).toBe(0);
    expect(result?.matchableUsers).toBe(0);
  });
});

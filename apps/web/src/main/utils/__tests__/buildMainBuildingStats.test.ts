import { describe, it, expect } from 'vitest';
import { buildMainBuildingStats } from '../buildMainBuildingStats';
import type { UserProfile } from '@/types/profile';
import type { RoommateProfile } from '@/types/profile';
import type { BuildingStatsSnapshot } from '@/main/types/home';

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
  earphoneExpectation: 'STUDY',
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

const baseSummary: BuildingStatsSnapshot = {
  totalParticipants: 135,
  assignedParticipants: 120,
  todayNewTotal: 5,
  todayNewBuilding: 2,
  totalMatchSuccess: 8,
  buildingMatchSuccess: 3,
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

let nextProfileId = 0;
function makeProfile(
  overrides: Partial<Omit<RoommateProfile, 'matchScore'>> = {},
): Omit<RoommateProfile, 'matchScore'> {
  nextProfileId += 1;
  return {
    id: `p-${nextProfileId}`,
    nickname: '프로필',
    gender: 'M',
    campus: 'CHUNCHEON' as const,
    dormitoryId: 'dasan',
    lifestyle: baseLifestyle,
    intro: '',
    messageToRoommate: null,
    additional: baseAdditional,
    ...overrides,
  };
}

describe('buildMainBuildingStats', () => {
  it('건물 미배정(null) 시에도 통계를 반환한다', () => {
    const user = makeUser({ dormitoryId: null });
    const result = buildMainBuildingStats(user, [], baseSummary);
    expect(result).toBeDefined();
    expect(result.buildingTotal).toBe(0);
    expect(result.buildingMatchable).toBe(0);
    expect(result.todayNewBuilding).toBe(0);
    expect(result.buildingMatchSuccess).toBe(0);
  });

  it('건물 미배정(unassigned) 시에도 통계를 반환한다', () => {
    const user = makeUser({ dormitoryId: 'unassigned' });
    const result = buildMainBuildingStats(user, [makeProfile()], baseSummary);
    expect(result).toBeDefined();
    expect(result.buildingTotal).toBe(0);
  });

  it('같은 건물 프로필을 buildingTotal로 집계한다', () => {
    const user = makeUser({ dormitoryId: 'dasan' });
    const profiles = [
      makeProfile({ dormitoryId: 'dasan', gender: 'M' }),
      makeProfile({ dormitoryId: 'dasan', gender: 'F' }),
      makeProfile({ dormitoryId: 'saerom', gender: 'M' }),
    ];
    const result = buildMainBuildingStats(user, profiles, baseSummary);
    expect(result.buildingTotal).toBe(2);
  });

  it('같은 건물 + 같은 성별만 buildingMatchable로 집계한다', () => {
    const user = makeUser({ dormitoryId: 'saerom', gender: 'M' });
    const profiles = [
      makeProfile({ dormitoryId: 'saerom', gender: 'M' }),
      makeProfile({ dormitoryId: 'saerom', gender: 'F' }),
      makeProfile({ dormitoryId: 'saerom', gender: 'M' }),
    ];
    const result = buildMainBuildingStats(user, profiles, baseSummary);
    expect(result.buildingTotal).toBe(3);
    expect(result.buildingMatchable).toBe(2);
  });

  it('주입된 summary 값을 전체 참여/배정 유저 수로 사용한다', () => {
    const user = makeUser({ dormitoryId: 'dasan' });
    const summary = { ...baseSummary, totalParticipants: 222, assignedParticipants: 111 };
    const result = buildMainBuildingStats(user, [makeProfile()], summary);
    expect(result.totalParticipants).toBe(222);
    expect(result.assignedParticipants).toBe(111);
  });

  it('비흡연이 과반이면 popularCondition에 포함된다', () => {
    const user = makeUser({ dormitoryId: 'dasan' });
    const profiles = [
      makeProfile({ dormitoryId: 'dasan', lifestyle: { ...baseLifestyle, smokingBehavior: 'NO' } }),
      makeProfile({ dormitoryId: 'dasan', lifestyle: { ...baseLifestyle, smokingBehavior: 'NO' } }),
      makeProfile({
        dormitoryId: 'dasan',
        lifestyle: { ...baseLifestyle, smokingBehavior: 'YES' },
      }),
    ];
    const result = buildMainBuildingStats(user, profiles, baseSummary);
    expect(result.popularCondition).toContain('비흡연');
  });

  it('24시 이전 취침이 과반이면 popularCondition에 포함된다', () => {
    const user = makeUser({ dormitoryId: 'dasan' });
    const profiles = [
      makeProfile({ dormitoryId: 'dasan', lifestyle: { ...baseLifestyle, bedtime: 'BEFORE_22' } }),
      makeProfile({ dormitoryId: 'dasan', lifestyle: { ...baseLifestyle, bedtime: '22_24' } }),
      makeProfile({ dormitoryId: 'dasan', lifestyle: { ...baseLifestyle, bedtime: 'AFTER_02' } }),
    ];
    const result = buildMainBuildingStats(user, profiles, baseSummary);
    expect(result.popularCondition).toContain('24시 이전 취침');
  });

  it('조건을 충족하지 않으면 popularCondition이 "-"이다', () => {
    const user = makeUser({ dormitoryId: 'dasan' });
    const profiles = [
      makeProfile({
        dormitoryId: 'dasan',
        lifestyle: { ...baseLifestyle, smokingBehavior: 'YES', bedtime: 'AFTER_02' },
      }),
      makeProfile({
        dormitoryId: 'dasan',
        lifestyle: { ...baseLifestyle, smokingBehavior: 'YES', bedtime: 'AFTER_02' },
      }),
    ];
    const result = buildMainBuildingStats(user, profiles, baseSummary);
    expect(result.popularCondition).toBe('-');
  });

  it('같은 건물 프로필이 없으면 buildingTotal이 0이다', () => {
    const user = makeUser({ dormitoryId: 'dasan' });
    const result = buildMainBuildingStats(user, [], baseSummary);
    expect(result.buildingTotal).toBe(0);
    expect(result.buildingMatchable).toBe(0);
  });

  it('주입된 summary 값을 오늘 신규/매칭 성공 수치로 사용한다', () => {
    const user = makeUser({ dormitoryId: 'dasan' });
    const summary = {
      ...baseSummary,
      todayNewTotal: 9,
      todayNewBuilding: 4,
      totalMatchSuccess: 12,
      buildingMatchSuccess: 5,
    };
    const result = buildMainBuildingStats(user, [makeProfile()], summary);
    expect(result.todayNewTotal).toBe(9);
    expect(result.todayNewBuilding).toBe(4);
    expect(result.totalMatchSuccess).toBe(12);
    expect(result.buildingMatchSuccess).toBe(5);
  });

  it('미배정 유저는 건물 관련 수치가 0이다', () => {
    const user = makeUser({ dormitoryId: null });
    const result = buildMainBuildingStats(user, [], baseSummary);
    expect(result.todayNewBuilding).toBe(0);
    expect(result.buildingMatchSuccess).toBe(0);
    expect(result.todayNewTotal).toBe(5);
    expect(result.totalMatchSuccess).toBe(8);
  });
});

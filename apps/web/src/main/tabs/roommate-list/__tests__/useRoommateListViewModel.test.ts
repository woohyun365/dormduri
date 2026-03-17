import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRoommateListViewModel } from '../useRoommateListViewModel';
import { calcMatchScore } from '@/utils/matchScore';
import { getMatchButtonState } from '@/utils/matchRequest';
import type { FilterState } from '@/types/filter';
import type { UserProfile, RoommateProfile } from '@/types/profile';
import type { MatchRequest, ActiveMatch } from '@/types/match';
import type { LifestyleData } from '@/types/lifestyle';

// matchScore mock: bedtime 기준으로 점수 차등 반환
vi.mock('@/utils/matchScore', () => ({
  calcMatchScore: vi.fn((_mine: LifestyleData, theirs: LifestyleData) => {
    const scoreMap: Record<string, number> = {
      BEFORE_22: 90,
      '22_24': 70,
      '24_02': 50,
      AFTER_02: 30,
    };
    return theirs.bedtime ? (scoreMap[theirs.bedtime] ?? 50) : 50;
  }),
}));

vi.mock('@/constants/season', () => ({
  CURRENT_SEASON: {
    name: 'test',
    matchingStart: '2020-01-01',
    matchingEnd: '2099-12-31',
    roomSelectionStart: '2020-01-01',
    roomSelectionEnd: '2099-12-31',
  },
  isSeasonActive: () => true,
}));

vi.mock('@/utils/matchRequest', () => ({
  getMatchButtonState: vi.fn(() => ({ type: 'REQUEST', label: '매칭 요청' })),
}));

const baseLifestyle: LifestyleData = {
  smoker: 'NO',
  sleepHabit: 'NONE',
  indoorEating: 'NO',
  bedtime: '22_24',
  wakeTime: '06_08',
  noiseSensitivity: 'MID',
  cleanliness: 'MID',
  relationshipStyle: 'CASUAL',
};

const baseAdditional = {
  college: null,
  grade: null,
  mbti: null,
  temperatureSensitivity: null,
} as const;

const baseUser: UserProfile = {
  id: 'test-user-0001',
  nickname: '테스터',
  gender: 'M',
  campus: 'CHUNCHEON',
  dormitoryId: 'dasan',
  lifestyle: baseLifestyle,
  intro: '안녕하세요',
  messageToRoommate: null,
  additional: { ...baseAdditional },
};

function makeProfile(
  overrides: Partial<Omit<RoommateProfile, 'matchScore'>> & { id: string },
): Omit<RoommateProfile, 'matchScore'> {
  return {
    nickname: overrides.id,
    gender: 'M',
    dormitoryId: 'dasan',
    lifestyle: { ...baseLifestyle },
    intro: '',
    messageToRoommate: null,
    additional: { ...baseAdditional },
    ...overrides,
  };
}

const defaultFilters: FilterState = {
  smoker: null,
  bedtime: null,
  wakeTime: null,
  noiseSensitivity: null,
  cleanliness: null,
  sleepHabit: null,
  indoorEating: null,
  relationshipStyle: null,
};

interface SetupParams {
  rawProfiles?: Omit<RoommateProfile, 'matchScore'>[];
  user?: UserProfile;
  filters?: FilterState;
  sortMode?: 'match' | 'recent';
  viewMode?: 'all' | 'bookmarked';
  blockedUserIds?: Set<string>;
  bookmarkedUserIds?: Set<string>;
  matchRequests?: MatchRequest[];
  activeMatch?: ActiveMatch | null;
}

function setup(overrides: SetupParams = {}) {
  return renderHook(() =>
    useRoommateListViewModel({
      rawProfiles: overrides.rawProfiles ?? [makeProfile({ id: 'p1' }), makeProfile({ id: 'p2' })],
      user: overrides.user ?? baseUser,
      filters: overrides.filters ?? defaultFilters,
      sortMode: overrides.sortMode ?? 'match',
      viewMode: overrides.viewMode ?? 'all',
      blockedUserIds: overrides.blockedUserIds,
      bookmarkedUserIds: overrides.bookmarkedUserIds,
      matchRequests: overrides.matchRequests ?? [],
      activeMatch: overrides.activeMatch ?? null,
    }),
  );
}

beforeEach(() => {
  vi.mocked(calcMatchScore).mockClear();
  vi.mocked(getMatchButtonState).mockClear();
});

// === 성별 필터 ===
describe('성별 필터', () => {
  it('같은 성별의 프로필만 반환한다', () => {
    const profiles = [
      makeProfile({ id: 'male-1', gender: 'M' }),
      makeProfile({ id: 'female-1', gender: 'F' }),
      makeProfile({ id: 'male-2', gender: 'M' }),
    ];
    const { result } = setup({ rawProfiles: profiles });
    expect(result.current.filteredProfiles.map((p) => p.id)).toEqual(['male-1', 'male-2']);
  });

  it('여성 유저는 여성 프로필만 본다', () => {
    const femaleUser = { ...baseUser, gender: 'F' as const, dormitoryId: 'yeji' };
    const profiles = [
      makeProfile({ id: 'male-1', gender: 'M', dormitoryId: 'yeji' }),
      makeProfile({ id: 'female-1', gender: 'F', dormitoryId: 'yeji' }),
    ];
    const { result } = setup({ rawProfiles: profiles, user: femaleUser });
    expect(result.current.filteredProfiles).toHaveLength(1);
    expect(result.current.filteredProfiles[0]!.id).toBe('female-1');
  });
});

// === 차단 유저 필터 ===
describe('차단 유저 필터', () => {
  it('차단된 유저가 제외된다', () => {
    const profiles = [makeProfile({ id: 'p1' }), makeProfile({ id: 'blocked-user' })];
    const { result } = setup({
      rawProfiles: profiles,
      blockedUserIds: new Set(['blocked-user']),
    });
    expect(result.current.filteredProfiles).toHaveLength(1);
    expect(result.current.filteredProfiles[0]!.id).toBe('p1');
  });

  it('빈 차단 목록은 영향 없다', () => {
    const { result } = setup({ blockedUserIds: new Set() });
    expect(result.current.filteredProfiles).toHaveLength(2);
  });
});

// === 뷰 모드 ===
describe('뷰 모드', () => {
  it('bookmarked 모드에서 북마크된 프로필만 반환한다', () => {
    const profiles = [makeProfile({ id: 'p1' }), makeProfile({ id: 'p2' })];
    const { result } = setup({
      rawProfiles: profiles,
      viewMode: 'bookmarked',
      bookmarkedUserIds: new Set(['p1']),
    });
    expect(result.current.filteredProfiles).toHaveLength(1);
    expect(result.current.filteredProfiles[0]!.id).toBe('p1');
  });

  it('bookmarked 모드에서 건물 필터가 무시된다', () => {
    const profiles = [
      makeProfile({ id: 'p1', dormitoryId: 'dasan' }),
      makeProfile({ id: 'p2', dormitoryId: 'toegye' }),
    ];
    const { result } = setup({
      rawProfiles: profiles,
      viewMode: 'bookmarked',
      bookmarkedUserIds: new Set(['p1', 'p2']),
    });
    expect(result.current.filteredProfiles).toHaveLength(2);
  });

  it('all 모드에서 같은 건물 프로필만 반환한다', () => {
    const profiles = [
      makeProfile({ id: 'same-dorm', dormitoryId: 'dasan' }),
      makeProfile({ id: 'diff-dorm', dormitoryId: 'toegye' }),
    ];
    const { result } = setup({ rawProfiles: profiles, viewMode: 'all' });
    expect(result.current.filteredProfiles).toHaveLength(1);
    expect(result.current.filteredProfiles[0]!.id).toBe('same-dorm');
  });
});

// === 건물 필터 ===
describe('건물 필터', () => {
  it('미배정 유저는 모든 건물의 프로필을 본다', () => {
    const unassignedUser = { ...baseUser, dormitoryId: 'unassigned' };
    const profiles = [
      makeProfile({ id: 'p1', dormitoryId: 'dasan' }),
      makeProfile({ id: 'p2', dormitoryId: 'toegye' }),
    ];
    const { result } = setup({ rawProfiles: profiles, user: unassignedUser });
    expect(result.current.filteredProfiles).toHaveLength(2);
  });

  it('isUnassigned가 미배정 유저에서 true를 반환한다', () => {
    const unassignedUser = { ...baseUser, dormitoryId: 'unassigned' };
    const { result } = setup({ user: unassignedUser });
    expect(result.current.isUnassigned).toBe(true);
  });

  it('isUnassigned가 배정된 유저에서 false를 반환한다', () => {
    const { result } = setup();
    expect(result.current.isUnassigned).toBe(false);
  });
});

// === 생활패턴 필터 ===
describe('생활패턴 필터', () => {
  it('단일 필터를 적용한다 (smoker)', () => {
    const profiles = [
      makeProfile({ id: 'nonsmoker', lifestyle: { ...baseLifestyle, smoker: 'NO' } }),
      makeProfile({ id: 'smoker', lifestyle: { ...baseLifestyle, smoker: 'YES' } }),
    ];
    const { result } = setup({
      rawProfiles: profiles,
      filters: { ...defaultFilters, smoker: 'NO' },
    });
    expect(result.current.filteredProfiles).toHaveLength(1);
    expect(result.current.filteredProfiles[0]!.id).toBe('nonsmoker');
  });

  it('복수 필터를 동시에 적용한다', () => {
    const profiles = [
      makeProfile({
        id: 'match',
        lifestyle: { ...baseLifestyle, smoker: 'NO', cleanliness: 'HIGH' },
      }),
      makeProfile({
        id: 'partial',
        lifestyle: { ...baseLifestyle, smoker: 'NO', cleanliness: 'LOW' },
      }),
      makeProfile({
        id: 'none',
        lifestyle: { ...baseLifestyle, smoker: 'YES', cleanliness: 'HIGH' },
      }),
    ];
    const { result } = setup({
      rawProfiles: profiles,
      filters: { ...defaultFilters, smoker: 'NO', cleanliness: 'HIGH' },
    });
    expect(result.current.filteredProfiles).toHaveLength(1);
    expect(result.current.filteredProfiles[0]!.id).toBe('match');
  });

  it('sleepHabit HAS는 NONE이 아닌 값을 통과시킨다', () => {
    const profiles = [
      makeProfile({ id: 'has', lifestyle: { ...baseLifestyle, sleepHabit: 'SNORING' } }),
      makeProfile({ id: 'none', lifestyle: { ...baseLifestyle, sleepHabit: 'NONE' } }),
    ];
    const { result } = setup({
      rawProfiles: profiles,
      filters: { ...defaultFilters, sleepHabit: 'HAS' },
    });
    expect(result.current.filteredProfiles).toHaveLength(1);
    expect(result.current.filteredProfiles[0]!.id).toBe('has');
  });

  it('sleepHabit HAS는 null인 프로필도 제외한다', () => {
    const profiles = [
      makeProfile({ id: 'has', lifestyle: { ...baseLifestyle, sleepHabit: 'TALKING' } }),
      makeProfile({ id: 'null-habit', lifestyle: { ...baseLifestyle, sleepHabit: null } }),
    ];
    const { result } = setup({
      rawProfiles: profiles,
      filters: { ...defaultFilters, sleepHabit: 'HAS' },
    });
    expect(result.current.filteredProfiles).toHaveLength(1);
    expect(result.current.filteredProfiles[0]!.id).toBe('has');
  });

  it('필터가 모든 프로필을 제외하면 빈 배열을 반환한다', () => {
    const profiles = [makeProfile({ id: 'p1', lifestyle: { ...baseLifestyle, smoker: 'YES' } })];
    const { result } = setup({
      rawProfiles: profiles,
      filters: { ...defaultFilters, smoker: 'NO' },
    });
    expect(result.current.filteredProfiles).toHaveLength(0);
  });
});

// === 정렬 ===
describe('정렬', () => {
  it('match 모드에서 matchScore 내림차순으로 정렬한다', () => {
    const profiles = [
      makeProfile({ id: 'low', lifestyle: { ...baseLifestyle, bedtime: 'AFTER_02' } }),
      makeProfile({ id: 'high', lifestyle: { ...baseLifestyle, bedtime: 'BEFORE_22' } }),
      makeProfile({ id: 'mid', lifestyle: { ...baseLifestyle, bedtime: '24_02' } }),
    ];
    const { result } = setup({ rawProfiles: profiles, sortMode: 'match' });
    const ids = result.current.filteredProfiles.map((p) => p.id);
    expect(ids).toEqual(['high', 'mid', 'low']);
  });

  it('recent 모드에서 원래 순서를 유지한다', () => {
    const profiles = [
      makeProfile({ id: 'low', lifestyle: { ...baseLifestyle, bedtime: 'AFTER_02' } }),
      makeProfile({ id: 'high', lifestyle: { ...baseLifestyle, bedtime: 'BEFORE_22' } }),
    ];
    const { result } = setup({ rawProfiles: profiles, sortMode: 'recent' });
    const ids = result.current.filteredProfiles.map((p) => p.id);
    expect(ids).toEqual(['low', 'high']);
  });
});

// === 헤더 타이틀 ===
describe('헤더 타이틀', () => {
  it('배정된 유저의 headerTitle에 건물 이름이 포함된다', () => {
    const { result } = setup();
    expect(result.current.headerTitle).toBe('다산관 룸메이트');
    expect(result.current.dormName).toBe('다산관');
  });

  it('미배정 유저의 headerTitle은 "룸메이트 찾기"이다', () => {
    const unassignedUser = { ...baseUser, dormitoryId: 'unassigned' };
    const { result } = setup({ user: unassignedUser });
    expect(result.current.headerTitle).toBe('룸메이트 찾기');
    expect(result.current.dormName).toBeNull();
  });
});

// === 활성 필터 ===
describe('활성 필터', () => {
  it('필터가 없으면 activeFilterCount는 0이다', () => {
    const { result } = setup();
    expect(result.current.activeFilterCount).toBe(0);
    expect(result.current.activeFilters).toHaveLength(0);
  });

  it('필터가 설정되면 activeFilterCount가 증가한다', () => {
    const { result } = setup({
      filters: { ...defaultFilters, smoker: 'NO', cleanliness: 'HIGH' },
    });
    expect(result.current.activeFilterCount).toBe(2);
    expect(result.current.activeFilters).toHaveLength(2);
  });
});

// === getFilterLabel ===
describe('getFilterLabel', () => {
  it('일반 생활패턴 라벨을 반환한다', () => {
    const { result } = setup();
    expect(result.current.getFilterLabel('smoker', 'NO')).toBe('비흡연');
  });

  it('sleepHabit HAS는 "있음"을 반환한다', () => {
    const { result } = setup();
    expect(result.current.getFilterLabel('sleepHabit', 'HAS')).toBe('있음');
  });
});

// === getButtonState 위임 ===
describe('getButtonState', () => {
  it('getMatchButtonState에 올바른 인자를 전달한다', () => {
    const profile = { ...makeProfile({ id: 'target' }), matchScore: 70 } as RoommateProfile;
    const blocked = new Set(['x']);
    const { result } = setup({ blockedUserIds: blocked });

    result.current.getButtonState(profile);

    expect(getMatchButtonState).toHaveBeenCalledWith({
      currentUserId: 'test-user-0001',
      targetUserId: 'target',
      targetDormitoryId: 'dasan',
      userDormitoryId: 'dasan',
      requests: [],
      activeMatch: null,
      blockedUserIds: blocked,
      isSeasonActive: true,
    });
  });
});

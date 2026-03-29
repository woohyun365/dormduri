import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { homeApi } from '../home';
import { mockDb } from '@/__fixtures__/mock-db';
import type { UserProfile, RoommateProfile } from '@/types/profile';

const baseLifestyle = {} as UserProfile['lifestyle'];
const baseAdditional = { college: null, grade: null, mbti: null, birthYear: null };

const user: UserProfile = {
  id: 'u1',
  nickname: '테스트',
  gender: 'M',
  campus: 'CHUNCHEON',
  dormitoryId: 'dasan',
  lifestyle: baseLifestyle,
  intro: '',
  messageToRoommate: null,
  additional: baseAdditional,
};

const profiles: Omit<RoommateProfile, 'matchScore'>[] = [
  {
    id: 'p1',
    nickname: '프로필1',
    gender: 'M',
    campus: 'CHUNCHEON',
    dormitoryId: 'dasan',
    lifestyle: baseLifestyle,
    intro: '',
    messageToRoommate: null,
    additional: baseAdditional,
  },
];

describe('homeApi', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
    localStorage.clear();
    mockDb.resetHomeDashboardState();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('building stats를 mock DB -> service 경유로 반환한다', async () => {
    mockDb.setHomeDashboardState({
      buildingStats: {
        totalParticipants: 222,
        assignedParticipants: 111,
        todayNewTotal: 9,
        todayNewBuilding: 4,
        totalMatchSuccess: 12,
        buildingMatchSuccess: 5,
      },
    });

    const result = await homeApi.getBuildingStats(user, profiles);
    expect(result.totalParticipants).toBe(222);
    expect(result.assignedParticipants).toBe(111);
    expect(result.todayNewTotal).toBe(9);
    expect(result.todayNewBuilding).toBe(4);
    expect(result.totalMatchSuccess).toBe(12);
    expect(result.buildingMatchSuccess).toBe(5);
  });

  it('과거 시즌 preset을 mock service 경유로 반환한다', async () => {
    mockDb.setHomeDashboardState({ pastSeason: 'matched' });
    await expect(homeApi.getPastSeasonResult()).resolves.toMatchObject({
      matched: true,
      partnerName: '홍길동',
    });
  });

  it('다음 시즌 등록 override를 반환한다', async () => {
    mockDb.setHomeDashboardState({ nextSeasonRegisteredOverride: true });
    await expect(homeApi.getNextSeasonRegisteredOverride()).resolves.toBe(true);
  });
});

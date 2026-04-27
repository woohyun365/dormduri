import { UsersService } from './users.service.js';
import type { UserWithProfileRecord } from '../profiles/profile.mapper.js';

type UserOverride = Omit<Partial<UserWithProfileRecord>, 'profile'> & {
  profile?: Partial<NonNullable<UserWithProfileRecord['profile']>>;
};

function makeUser(overrides: UserOverride = {}): UserWithProfileRecord {
  const { profile: profileOverrides, ...userOverrides } = overrides;
  const baseProfile = {
    userId: 'user-1',
    nickname: '테스터',
    nicknameNormalized: '테스터',
    nicknameChangedAt: null,
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
    messageToRoommate: null,
    college: null,
    grade: null,
    mbti: null,
    birthYear: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  return {
    id: 'user-1',
    email: 'test@kangwon.ac.kr',
    gender: 'M' as const,
    campus: 'CHUNCHEON' as const,
    dormitoryId: null,
    dormitorySelectionState: 'NOT_SELECTED' as const,
    profile: { ...baseProfile, ...profileOverrides },
    ...userOverrides,
  };
}

describe('UsersService', () => {
  const txUserUpdate = jest.fn();
  const txUserProfileUpdate = jest.fn();
  const prisma = {
    getDatabaseNow: jest.fn(),
    $transaction: jest.fn(),
    campusMaster: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    userProfile: {
      update: jest.fn(),
    },
  };
  const seasonsService = {
    getCurrentSeasonContext: jest.fn(),
  };
  const moderationService = {
    moderatePublicText: jest.fn(),
  };

  const service = new UsersService(
    prisma as never,
    seasonsService as never,
    moderationService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(new Date('2026-02-10T03:00:00.000Z'));
    prisma.campusMaster.findUnique.mockResolvedValue({ isOperated: true });
    seasonsService.getCurrentSeasonContext.mockResolvedValue(null);
    moderationService.moderatePublicText.mockResolvedValue({ ok: true });
    txUserUpdate.mockResolvedValue(undefined);
    txUserProfileUpdate.mockResolvedValue(undefined);
    prisma.$transaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback({
        user: { update: txUserUpdate },
        userProfile: { update: txUserProfileUpdate },
      }),
    );
  });

  it('운영 캠퍼스인데 current season row가 없으면 OFF_SEASON current user로 계산한다', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());

    const result = await service.getCurrentUser({
      id: 'user-1',
      gender: 'M',
      campus: 'CHUNCHEON',
      dormitoryId: null,
      dormitorySelectionState: 'NOT_SELECTED',
    });

    expect(result).toMatchObject({
      serviceState: {
        campusOperated: true,
        seasonState: 'OFF_SEASON',
      },
      readiness: {
        canBrowseProfiles: true,
      },
      capabilities: {
        canSelectDormitory: false,
        canBookmark: false,
        canRequestMatch: false,
      },
    });
  });

  it('SEASON_POST_MATCH + ASSIGNED에서는 bookmark를 허용하고 match는 금지한다', async () => {
    prisma.user.findUnique.mockResolvedValue(
      makeUser({
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      }),
    );
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      state: 'SEASON_POST_MATCH',
      operatedDormitories: [
        { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-02-11' },
      ],
      schedule: {
        preparationStart: '2026-01-01',
        matchingStart: '2026-01-28',
        matchingEnd: '2026-02-11',
        seasonEnd: '2026-02-28',
      },
    });

    const result = await service.getCurrentUser({
      id: 'user-1',
      gender: 'M',
      campus: 'CHUNCHEON',
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
    });

    expect(result.capabilities).toMatchObject({
      canBookmark: true,
      canRequestMatch: false,
    });
    expect(result.readiness.canBrowseProfiles).toBe(true);
  });

  it('시즌 준비 기간에는 NOT_SELECTED -> UNASSIGNED 전이를 허용한다', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(makeUser()).mockResolvedValueOnce(
      makeUser({
        dormitorySelectionState: 'UNASSIGNED',
      }),
    );
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      state: 'SEASON_PREPARATION',
      operatedDormitories: [
        { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-02-11' },
      ],
      schedule: {
        preparationStart: '2026-01-01',
        matchingStart: '2026-01-28',
        matchingEnd: '2026-02-11',
        seasonEnd: '2026-02-28',
      },
    });

    const result = await service.updateCurrentUser(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
        dormitoryId: null,
        dormitorySelectionState: 'NOT_SELECTED',
      },
      {
        selection: {
          state: 'UNASSIGNED',
          dormitoryId: null,
        },
      },
    );

    expect(txUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        dormitorySelectionState: 'UNASSIGNED',
        dormitoryId: null,
      },
    });
    expect(result.selection.state).toBe('UNASSIGNED');
  });
});

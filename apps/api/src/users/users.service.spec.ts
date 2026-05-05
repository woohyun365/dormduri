import { UsersService } from './users.service.js';
import type { UserWithProfileRecord } from '../profiles/profile.mapper.js';
import type {
  CanonicalProfileSource,
  CanonicalSelectionState,
} from '../season-participants/season-participants.service.js';
import { usersErrors } from './users.errors.js';

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
    collegeCode: null,
    grade: null,
    mbti: null,
    birthYear: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  return {
    id: 'user-1',
    email: 'test@kangwon.ac.kr',
    emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
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
  const txSeasonParticipantUpdate = jest.fn();
  const txSeasonParticipantProfileUpdate = jest.fn();
  const prisma = {
    getDatabaseNow: jest.fn(),
    $transaction: jest.fn(),
    campusMaster: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    collegeMaster: {
      findUnique: jest.fn(),
    },
    dormitory: {
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
  const seasonParticipantsService = {
    ensureCurrentSeasonParticipantForUser: jest.fn(),
    selectCanonicalSelection: jest.fn(),
    selectCanonicalProfile: jest.fn(),
  };

  const service = new UsersService(
    prisma as never,
    seasonsService as never,
    moderationService as never,
    seasonParticipantsService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(new Date('2026-02-10T03:00:00.000Z'));
    prisma.campusMaster.findUnique.mockResolvedValue({ isOperated: true });
    prisma.collegeMaster.findUnique.mockResolvedValue({
      code: 'HUMANITIES',
      campusCode: 'CHUNCHEON',
      nameKo: '인문대',
      isActive: true,
    });
    prisma.dormitory.findUnique.mockResolvedValue({
      id: 'dasan',
      campusCode: 'CHUNCHEON',
      genderPolicy: 'M',
    });
    seasonsService.getCurrentSeasonContext.mockResolvedValue(null);
    moderationService.moderatePublicText.mockResolvedValue({ ok: true });
    txUserUpdate.mockResolvedValue(undefined);
    txUserProfileUpdate.mockResolvedValue(undefined);
    txSeasonParticipantUpdate.mockResolvedValue(undefined);
    txSeasonParticipantProfileUpdate.mockResolvedValue(undefined);
    seasonParticipantsService.ensureCurrentSeasonParticipantForUser.mockResolvedValue(null);
    seasonParticipantsService.selectCanonicalSelection.mockImplementation(
      (
        user: Pick<UserWithProfileRecord, 'dormitoryId' | 'dormitorySelectionState'>,
      ): CanonicalSelectionState => ({
        dormitoryId: user.dormitoryId,
        dormitorySelectionState: user.dormitorySelectionState,
        source: 'user',
      }),
    );
    seasonParticipantsService.selectCanonicalProfile.mockImplementation(
      (userProfile: NonNullable<UserWithProfileRecord['profile']>): CanonicalProfileSource => ({
        source: 'user-profile',
        nickname: userProfile.nickname,
        nicknameNormalized: userProfile.nicknameNormalized,
        lifestyle: userProfile.lifestyle,
        intro: userProfile.intro,
        messageToRoommate: userProfile.messageToRoommate,
        collegeCode: userProfile.collegeCode,
        grade: userProfile.grade,
        mbti: userProfile.mbti,
        birthYear: userProfile.birthYear,
      }),
    );
    prisma.$transaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback({
        user: { update: txUserUpdate },
        userProfile: { update: txUserProfileUpdate },
        seasonParticipant: { update: txSeasonParticipantUpdate },
        seasonParticipantProfile: { update: txSeasonParticipantProfileUpdate },
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
      state: 'SEASON_OPEN',
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

  it('current season participant가 있으면 selection은 participant canonical source를 따른다', async () => {
    prisma.user.findUnique.mockResolvedValue(
      makeUser({
        dormitoryId: null,
        dormitorySelectionState: 'NOT_SELECTED',
      }),
    );
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      season: { id: 'season-1' },
      state: 'SEASON_MATCHING',
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
    seasonParticipantsService.ensureCurrentSeasonParticipantForUser.mockResolvedValue({
      id: 'participant-1',
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
      profile: null,
    });
    seasonParticipantsService.selectCanonicalSelection.mockReturnValue({
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
      source: 'season-participant',
    });

    const result = await service.getCurrentUser({
      id: 'user-1',
      gender: 'M',
      campus: 'CHUNCHEON',
      dormitoryId: null,
      dormitorySelectionState: 'NOT_SELECTED',
    });

    expect(result.selection).toEqual({
      dormitoryId: 'dasan',
      state: 'ASSIGNED',
    });
    expect(result.capabilities.canBookmark).toBe(true);
  });

  it('current season participant가 있으면 selection update를 participant에도 동기화한다', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(makeUser()).mockResolvedValueOnce(
      makeUser({
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      }),
    );
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      season: { id: 'season-1' },
      state: 'SEASON_MATCHING',
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
    seasonParticipantsService.ensureCurrentSeasonParticipantForUser.mockResolvedValue({
      id: 'participant-1',
      dormitoryId: null,
      dormitorySelectionState: 'NOT_SELECTED',
      profile: null,
    });
    seasonParticipantsService.selectCanonicalSelection
      .mockReturnValueOnce({
        dormitoryId: null,
        dormitorySelectionState: 'NOT_SELECTED',
        source: 'season-participant',
      })
      .mockReturnValueOnce({
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
        source: 'season-participant',
      });

    await service.updateCurrentUser(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
        dormitoryId: null,
        dormitorySelectionState: 'NOT_SELECTED',
      },
      {
        selection: {
          state: 'ASSIGNED',
          dormitoryId: 'dasan',
        },
      },
    );

    expect(txSeasonParticipantUpdate).toHaveBeenCalledWith({
      where: { id: 'participant-1' },
      data: {
        dormitorySelectionState: 'ASSIGNED',
        dormitoryId: 'dasan',
      },
    });
  });

  it('valid college code는 user profile과 season participant profile에 함께 저장한다', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(makeUser()).mockResolvedValueOnce(
      makeUser({
        profile: {
          collegeCode: 'HUMANITIES',
        },
      }),
    );
    prisma.collegeMaster.findUnique.mockResolvedValue({
      code: 'HUMANITIES',
      campusCode: 'CHUNCHEON',
      nameKo: '인문대',
      isActive: true,
    });
    seasonParticipantsService.ensureCurrentSeasonParticipantForUser.mockResolvedValue({
      id: 'participant-1',
      dormitoryId: null,
      dormitorySelectionState: 'NOT_SELECTED',
      profile: { participantId: 'participant-1' },
    });

    await service.updateCurrentUser(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
        dormitoryId: null,
        dormitorySelectionState: 'NOT_SELECTED',
      },
      {
        additional: {
          college: 'HUMANITIES',
        },
      },
    );

    expect(txUserProfileUpdate).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: {
        collegeCode: 'HUMANITIES',
      },
    });
    expect(txSeasonParticipantProfileUpdate).toHaveBeenCalledWith({
      where: { participantId: 'participant-1' },
      data: {
        collegeCode: 'HUMANITIES',
      },
    });
  });

  it('다른 campus의 college code는 거부한다', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());
    prisma.collegeMaster.findUnique.mockResolvedValue({
      code: 'HUMANITIES',
      campusCode: 'SAMCHEOK',
      nameKo: '인문대',
      isActive: true,
    });

    try {
      await service.updateCurrentUser(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
          dormitoryId: null,
          dormitorySelectionState: 'NOT_SELECTED',
        },
        {
          additional: {
            college: 'HUMANITIES',
          },
        },
      );
      throw new Error('Expected updateCurrentUser to throw');
    } catch (error) {
      expect((error as { getResponse?: () => unknown }).getResponse?.()).toMatchObject(
        usersErrors
          .invalidPatch('현재 캠퍼스에서 선택할 수 없는 단과대입니다.', 'additional.college')
          .getResponse(),
      );
    }
  });

  it('current season participant profile이 있으면 current user profile source로 사용한다', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());
    seasonParticipantsService.ensureCurrentSeasonParticipantForUser.mockResolvedValue({
      id: 'participant-1',
      dormitoryId: null,
      dormitorySelectionState: 'NOT_SELECTED',
      profile: { participantId: 'participant-1' },
    });
    seasonParticipantsService.selectCanonicalProfile.mockReturnValue({
      source: 'season-participant-profile',
      nickname: '시즌닉네임',
      nicknameNormalized: '시즌닉네임',
      lifestyle: makeUser().profile!.lifestyle,
      intro: '시즌 소개',
      messageToRoommate: '시즌 메시지',
      collegeCode: 'HUMANITIES',
      grade: '4+',
      mbti: 'ENTP',
      birthYear: 2001,
    });

    const result = await service.getCurrentUser({
      id: 'user-1',
      gender: 'M',
      campus: 'CHUNCHEON',
      dormitoryId: null,
      dormitorySelectionState: 'NOT_SELECTED',
    });

    expect(result.user.nickname).toBe('시즌닉네임');
    expect(result.profile.intro).toBe('시즌 소개');
    expect(result.profile.additional.college).toBe('HUMANITIES');
  });
});

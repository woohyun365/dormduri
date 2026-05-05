import { ProfilesService } from './profiles.service.js';
import { profilesErrors } from './profiles.errors.js';
import type { UserWithProfileRecord } from './profile.mapper.js';
import type {
  CanonicalProfileSource,
  CanonicalSelectionState,
  CurrentSeasonParticipantRecord,
} from '../season-participants/season-participants.service.js';

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
    messageToRoommate: '잘 부탁해요',
    collegeCode: 'ARTS_ENGINEERING',
    grade: '3',
    mbti: 'INTJ',
    birthYear: 2002,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  return {
    id: 'user-1',
    email: 'test@kangwon.ac.kr',
    emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    gender: 'M' as const,
    campus: 'CHUNCHEON' as const,
    dormitoryId: 'dasan',
    dormitorySelectionState: 'ASSIGNED' as const,
    profile: { ...baseProfile, ...profileOverrides },
    ...userOverrides,
  };
}

const lifestylePayload: Record<string, unknown> = {
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

describe('ProfilesService', () => {
  const txUserProfileUpdate = jest.fn();
  const txSeasonParticipantProfileUpdate = jest.fn();
  const prisma = {
    getDatabaseNow: jest.fn(),
    $transaction: jest.fn(),
    campusMaster: {
      findUnique: jest.fn(),
    },
    collegeMaster: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    userProfile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const seasonsService = {
    getCurrentSeasonContext: jest.fn(),
  };
  const moderationService = {
    validateNicknamePolicy: jest.fn(),
  };
  const usersService = {
    getCurrentUser: jest.fn(),
  };
  const seasonParticipantsService = {
    ensureCurrentSeasonParticipantForUser: jest.fn(),
    selectCanonicalSelection: jest.fn(),
    selectCanonicalProfile: jest.fn(),
    pickCurrentSeasonParticipant: jest.fn(),
  };

  const service = new ProfilesService(
    prisma as never,
    seasonsService as never,
    moderationService as never,
    usersService as never,
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
    moderationService.validateNicknamePolicy.mockResolvedValue(null);
    usersService.getCurrentUser.mockResolvedValue({ success: true });
    txUserProfileUpdate.mockResolvedValue(undefined);
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
    seasonParticipantsService.pickCurrentSeasonParticipant.mockImplementation(
      (participants: CurrentSeasonParticipantRecord[] | null | undefined) =>
        participants?.[0] ?? null,
    );
    prisma.$transaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback({
        userProfile: { update: txUserProfileUpdate },
        seasonParticipantProfile: { update: txSeasonParticipantProfileUpdate },
      }),
    );
  });

  it('운영 캠퍼스 시즌 중 UNASSIGNED viewer는 프로필 목록이 빈 배열이다', async () => {
    prisma.user.findUnique.mockResolvedValue(
      makeUser({
        dormitoryId: null,
        dormitorySelectionState: 'UNASSIGNED',
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

    await expect(
      service.getProfiles(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
          dormitoryId: null,
          dormitorySelectionState: 'UNASSIGNED',
        },
        { offset: 0, limit: 20 },
      ),
    ).resolves.toEqual({ items: [] });
  });

  it('운영 캠퍼스 시즌 중에는 same-dormitory + same-gender만 노출한다', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());
    prisma.user.findMany.mockResolvedValue([
      makeUser({ id: 'peer-1', email: 'peer1@kangwon.ac.kr', profile: { nickname: '가나다' } }),
      makeUser({
        id: 'peer-2',
        email: 'peer2@kangwon.ac.kr',
        dormitoryId: 'saerom',
        profile: { nickname: '라마바' },
      }),
    ]);
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      season: { id: 'season-1' },
      state: 'SEASON_MATCHING',
      operatedDormitories: [
        { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-02-11' },
        { dormitoryId: 'saerom', isOperated: true, roomSelectionDate: '2026-02-12' },
      ],
      schedule: {
        preparationStart: '2026-01-01',
        matchingStart: '2026-01-28',
        matchingEnd: '2026-02-12',
        seasonEnd: '2026-02-28',
      },
    });

    const result = await service.getProfiles(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      { offset: 0, limit: 20 },
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe('peer-1');
    expect(result.items[0]?.lifestyle).not.toHaveProperty('drinkingFrequency');
    expect(result.items[0]?.lifestyle).not.toHaveProperty('drinkingTolerance');
  });

  it('오프시즌 같은 캠퍼스 타성별 상세는 PROFILE_NOT_VISIBLE로 숨긴다', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(makeUser()).mockResolvedValueOnce(
      makeUser({
        id: 'peer-female',
        email: 'peer-female@kangwon.ac.kr',
        gender: 'F',
        profile: { nickname: '여성상세' },
      }),
    );
    seasonsService.getCurrentSeasonContext.mockResolvedValue(null);

    await expect(
      service.getProfileByUserId(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        'peer-female',
      ),
    ).rejects.toMatchObject({
      response: profilesErrors.profileNotVisible().getResponse(),
    });
  });

  it('시즌 중 같은 기숙사라도 타성별 상세는 PROFILE_NOT_VISIBLE로 숨긴다', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(makeUser()).mockResolvedValueOnce(
      makeUser({
        id: 'peer-female',
        email: 'peer-female@kangwon.ac.kr',
        gender: 'F',
        profile: { nickname: '여성상세' },
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

    await expect(
      service.getProfileByUserId(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        'peer-female',
      ),
    ).rejects.toMatchObject({
      response: profilesErrors.profileNotVisible().getResponse(),
    });
  });

  it('SEASON_MATCHING + ASSIGNED에서는 lifestyle 수정을 잠근다', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());
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

    try {
      await service.updateLifestyle(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        lifestylePayload,
      );
      throw new Error('Expected updateLifestyle to throw');
    } catch (error) {
      expect((error as { getResponse?: () => unknown }).getResponse?.()).toMatchObject(
        profilesErrors.profileEditLocked().getResponse(),
      );
    }
  });

  it('current season participant profile이 있으면 lifestyle update를 season profile에도 동기화한다', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      season: { id: 'season-1' },
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
    seasonParticipantsService.ensureCurrentSeasonParticipantForUser.mockResolvedValue({
      id: 'participant-1',
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
      profile: { participantId: 'participant-1' },
    });

    await service.updateLifestyle(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      lifestylePayload,
    );

    expect(txSeasonParticipantProfileUpdate).toHaveBeenCalledWith({
      where: { participantId: 'participant-1' },
      data: {
        lifestyle: lifestylePayload,
      },
    });
  });

  it('시즌 구간에서는 nickname 변경을 잠근다', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      season: { id: 'season-1' },
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

    try {
      await service.updateNickname(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        '새닉네임',
      );
      throw new Error('Expected updateNickname to throw');
    } catch (error) {
      expect((error as { getResponse?: () => unknown }).getResponse?.()).toMatchObject(
        profilesErrors.nicknameEditLocked().getResponse(),
      );
    }
  });

  it('current season participant profile이 있으면 공개 프로필 source로 season profile을 사용한다', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(makeUser()).mockResolvedValueOnce(
      Object.assign(makeUser({ id: 'peer-1', email: 'peer1@kangwon.ac.kr' }), {
        seasonParticipants: [
          {
            id: 'participant-1',
            dormitoryId: 'dasan',
            dormitorySelectionState: 'ASSIGNED',
            profile: { participantId: 'participant-1', nicknameSnapshot: '시즌상대닉네임' },
          },
        ],
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
    seasonParticipantsService.selectCanonicalProfile.mockImplementation(() => ({
      source: 'season-participant-profile',
      nickname: '시즌상대닉네임',
      nicknameNormalized: '시즌상대닉네임',
      lifestyle: makeUser().profile!.lifestyle,
      intro: '시즌 소개',
      messageToRoommate: '시즌 메시지',
      collegeCode: 'HUMANITIES',
      grade: '4+',
      mbti: 'ENTP',
      birthYear: 2001,
    }));

    const result = await service.getProfileByUserId(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      'peer-1',
    );

    expect(result.nickname).toBe('시즌상대닉네임');
    expect(result.intro).toBe('시즌 소개');
    expect(result.additional.college).toBe('HUMANITIES');
  });
});

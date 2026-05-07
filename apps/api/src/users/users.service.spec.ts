import { UsersService } from './users.service.js';
import type { UserWithProfileRecord } from '../profiles/profile.mapper.js';
import { usersErrors } from './users.errors.js';
import type {
  CanonicalProfileSource,
  CanonicalSelectionState,
} from '../season-participants/season-participants.service.js';

type UserOverride = Omit<Partial<UserWithProfileRecord>, 'profile'> & {
  profile?: Partial<NonNullable<UserWithProfileRecord['profile']>> | null;
};

function makeUser(overrides: UserOverride = {}): UserWithProfileRecord {
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

  const { profile: profileOverrides, ...userOverrides } = overrides;

  return {
    id: 'user-1',
    email: 'test@kangwon.ac.kr',
    emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    gender: 'M',
    campus: 'CHUNCHEON',
    dormitoryId: null,
    dormitorySelectionState: 'NOT_SELECTED',
    ...userOverrides,
    profile: profileOverrides === null ? null : { ...baseProfile, ...(profileOverrides ?? {}) },
  };
}

function makeParticipant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'participant-1',
    seasonId: 'season-1',
    userId: 'user-1',
    participationIntent: 'UNDECIDED',
    registeredAt: null,
    declinedAt: null,
    dormitoryId: null,
    dormitorySelectionState: 'NOT_SELECTED',
    participantStatus: 'NOT_STARTED',
    campusCodeSnapshot: 'CHUNCHEON',
    genderSnapshot: 'M',
    joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    activatedAt: null,
    matchedAt: null,
    withdrawnAt: null,
    expiredAt: null,
    hiddenByAdminAt: null,
    hiddenReasonCode: null,
    hiddenReasonDetail: null,
    deactivatedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    profile: null,
    ...overrides,
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
    selectProfileBySource: jest.fn(),
  };

  const matchesService = {
    getCurrentActiveMatchByParticipantId: jest.fn(),
    getCurrentActiveMatchSummaryForParticipant: jest.fn(),
  };

  const service = new UsersService(
    prisma as never,
    seasonsService as never,
    moderationService as never,
    seasonParticipantsService as never,
    matchesService as never,
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
    matchesService.getCurrentActiveMatchByParticipantId.mockResolvedValue(null);
    matchesService.getCurrentActiveMatchSummaryForParticipant.mockResolvedValue(null);
    seasonParticipantsService.selectCanonicalSelection.mockImplementation(
      (
        user: Pick<UserWithProfileRecord, 'dormitoryId' | 'dormitorySelectionState'>,
        participant: Pick<
          CanonicalSelectionState,
          'dormitoryId' | 'dormitorySelectionState'
        > | null,
      ): CanonicalSelectionState => ({
        dormitoryId: participant?.dormitoryId ?? user.dormitoryId,
        dormitorySelectionState:
          participant?.dormitorySelectionState ?? user.dormitorySelectionState,
        source: participant ? 'SEASON_PARTICIPANT' : 'USER',
      }),
    );
    seasonParticipantsService.selectProfileBySource.mockImplementation(
      (
        userProfile: NonNullable<UserWithProfileRecord['profile']>,
        participantProfile: {
          nicknameSnapshot: string;
          nicknameNormalizedSnapshot: string;
          lifestyle: NonNullable<UserWithProfileRecord['profile']>['lifestyle'];
          intro: string;
          messageToRoommate: string | null;
          collegeCode: string | null;
          grade: string | null;
          mbti: string | null;
          birthYear: number | null;
        } | null,
        source: CanonicalProfileSource['source'],
      ): CanonicalProfileSource =>
        source === 'SEASON_PARTICIPANT_PROFILE' && participantProfile
          ? {
              source: 'SEASON_PARTICIPANT_PROFILE',
              nickname: participantProfile.nicknameSnapshot,
              nicknameNormalized: participantProfile.nicknameNormalizedSnapshot,
              lifestyle: participantProfile.lifestyle,
              intro: participantProfile.intro,
              messageToRoommate: participantProfile.messageToRoommate,
              collegeCode: participantProfile.collegeCode,
              grade: participantProfile.grade,
              mbti: participantProfile.mbti,
              birthYear: participantProfile.birthYear,
            }
          : {
              source: 'USER_PROFILE',
              nickname: userProfile.nickname,
              nicknameNormalized: userProfile.nicknameNormalized,
              lifestyle: userProfile.lifestyle,
              intro: userProfile.intro,
              messageToRoommate: userProfile.messageToRoommate,
              collegeCode: userProfile.collegeCode,
              grade: userProfile.grade,
              mbti: userProfile.mbti,
              birthYear: userProfile.birthYear,
            },
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

    expect(result.serviceState).toEqual({
      campusOperated: true,
      seasonState: 'OFF_SEASON',
    });
    expect(result.participation).toEqual({
      hasCurrentSeason: false,
      hasParticipantRow: false,
      intent: null,
      registered: false,
      profileExists: false,
    });
    expect(result.profile.source).toBe('USER_PROFILE');
    expect(result.capabilities.canRegisterParticipation).toBe(false);
    expect(result.capabilities.canBrowseProfiles).toBe(true);
  });

  it('SEASON_OPEN 등록+배정 사용자는 시즌 프로필을 현재 source로 사용하고 채팅만 열린다', async () => {
    prisma.user.findUnique.mockResolvedValue(
      makeUser({ dormitoryId: 'dasan', dormitorySelectionState: 'ASSIGNED' }),
    );
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
    seasonParticipantsService.ensureCurrentSeasonParticipantForUser.mockResolvedValue(
      makeParticipant({
        participationIntent: 'REGISTERED',
        registeredAt: new Date('2026-01-05T00:00:00.000Z'),
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
        participantStatus: 'ACTIVE',
        profile: {
          participantId: 'participant-1',
          nicknameSnapshot: '시즌닉네임',
          nicknameNormalizedSnapshot: '시즌닉네임',
          lifestyle: makeUser().profile!.lifestyle,
          intro: '시즌 소개',
          messageToRoommate: '시즌 메시지',
          collegeCode: 'HUMANITIES',
          grade: '4+',
          mbti: 'ENTP',
          birthYear: 2001,
        },
      }),
    );

    const result = await service.getCurrentUser({
      id: 'user-1',
      gender: 'M',
      campus: 'CHUNCHEON',
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
    });

    expect(result.profile.source).toBe('SEASON_PARTICIPANT_PROFILE');
    expect(result.user.nickname).toBe('시즌닉네임');
    expect(result.participation.registered).toBe(true);
    expect(result.capabilities.canStartChat).toBe(true);
    expect(result.capabilities.canRequestMatch).toBe(false);
    expect(result.capabilities.canBookmark).toBe(true);
    expect(result.capabilities.profileEdit).toMatchObject({
      intro: true,
      messageToRoommate: true,
      additional: true,
      lifestyle: false,
      nickname: false,
    });
  });

  it('SEASON_MATCHING 등록+미배정 사용자는 LIMITED browse만 유지하고 action capability는 닫힌다', async () => {
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
    seasonParticipantsService.ensureCurrentSeasonParticipantForUser.mockResolvedValue(
      makeParticipant({
        participationIntent: 'REGISTERED',
        registeredAt: new Date('2026-01-05T00:00:00.000Z'),
        dormitorySelectionState: 'NOT_SELECTED',
        participantStatus: 'DRAFT',
        profile: {
          participantId: 'participant-1',
          nicknameSnapshot: '시즌닉네임',
          nicknameNormalizedSnapshot: '시즌닉네임',
          lifestyle: makeUser().profile!.lifestyle,
          intro: '시즌 소개',
          messageToRoommate: '시즌 메시지',
          collegeCode: 'HUMANITIES',
          grade: '4+',
          mbti: 'ENTP',
          birthYear: 2001,
        },
      }),
    );
    seasonParticipantsService.selectCanonicalSelection.mockReturnValue({
      dormitoryId: null,
      dormitorySelectionState: 'UNASSIGNED',
      source: 'SEASON_PARTICIPANT',
    });

    const result = await service.getCurrentUser({
      id: 'user-1',
      gender: 'M',
      campus: 'CHUNCHEON',
      dormitoryId: null,
      dormitorySelectionState: 'NOT_SELECTED',
    });

    expect(result.selection).toEqual({
      state: 'UNASSIGNED',
      dormitoryId: null,
      source: 'SEASON_PARTICIPANT',
    });
    expect(result.readiness.canBrowseProfiles).toBe(true);
    expect(result.capabilities.canSelectDormitory).toBe(true);
    expect(result.capabilities.canBookmark).toBe(false);
    expect(result.capabilities.canRequestMatch).toBe(false);
    expect(result.capabilities.canStartChat).toBe(false);
    expect(result.capabilities.profileEdit).toMatchObject({
      intro: false,
      messageToRoommate: true,
      additional: true,
    });
  });

  it('live ActiveMatch가 없으면 stale MATCHED participantStatus만으로 현재 매칭 상태를 잠그지 않는다', async () => {
    prisma.user.findUnique.mockResolvedValue(
      makeUser({ dormitoryId: 'dasan', dormitorySelectionState: 'ASSIGNED' }),
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
    seasonParticipantsService.ensureCurrentSeasonParticipantForUser.mockResolvedValue(
      makeParticipant({
        participationIntent: 'REGISTERED',
        registeredAt: new Date('2026-01-05T00:00:00.000Z'),
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
        participantStatus: 'MATCHED',
        matchedAt: new Date('2026-02-01T00:00:00.000Z'),
        profile: {
          participantId: 'participant-1',
          nicknameSnapshot: '시즌닉네임',
          nicknameNormalizedSnapshot: '시즌닉네임',
          lifestyle: makeUser().profile!.lifestyle,
          intro: '시즌 소개',
          messageToRoommate: '시즌 메시지',
          collegeCode: 'HUMANITIES',
          grade: '4+',
          mbti: 'ENTP',
          birthYear: 2001,
        },
      }),
    );
    matchesService.getCurrentActiveMatchSummaryForParticipant.mockResolvedValue(null);

    const result = await service.getCurrentUser({
      id: 'user-1',
      gender: 'M',
      campus: 'CHUNCHEON',
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
    });

    expect(result.match.activeMatch).toBeNull();
    expect(result.capabilities.canRequestMatch).toBe(true);
    expect(result.capabilities.canStartChat).toBe(true);
  });

  it('건물 선택은 시즌 참여자 등록 전에는 거부된다', async () => {
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
    seasonParticipantsService.ensureCurrentSeasonParticipantForUser.mockResolvedValue(
      makeParticipant(),
    );

    await expect(
      service.updateCurrentUser(
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
      ),
    ).rejects.toMatchObject({
      response: usersErrors.dormitorySelectionRequiresParticipation().getResponse(),
    });
  });

  it('SEASON_MATCHING 등록 사용자의 intro 수정은 잠근다', async () => {
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
    seasonParticipantsService.ensureCurrentSeasonParticipantForUser.mockResolvedValue(
      makeParticipant({
        participationIntent: 'REGISTERED',
        registeredAt: new Date('2026-01-05T00:00:00.000Z'),
        participantStatus: 'DRAFT',
        profile: { participantId: 'participant-1' },
      }),
    );

    await expect(
      service.updateCurrentUser(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
          dormitoryId: null,
          dormitorySelectionState: 'NOT_SELECTED',
        },
        { intro: '새 소개' },
      ),
    ).rejects.toMatchObject({
      response: usersErrors
        .profileFieldLocked('intro', '현재 시즌 상태에서는 자기소개를 수정할 수 없습니다.')
        .getResponse(),
    });
  });

  it('SEASON_MATCHING 등록 사용자의 additional은 base+season profile에 제한 sync한다', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(makeUser()).mockResolvedValueOnce(
      makeUser({
        profile: {
          collegeCode: 'HUMANITIES',
        },
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
    seasonParticipantsService.ensureCurrentSeasonParticipantForUser.mockResolvedValue(
      makeParticipant({
        participationIntent: 'REGISTERED',
        registeredAt: new Date('2026-01-05T00:00:00.000Z'),
        participantStatus: 'DRAFT',
        profile: {
          participantId: 'participant-1',
          nicknameSnapshot: '시즌닉네임',
          nicknameNormalizedSnapshot: '시즌닉네임',
          lifestyle: makeUser().profile!.lifestyle,
          intro: '시즌 소개',
          messageToRoommate: '시즌 메시지',
          collegeCode: 'ARTS_ENGINEERING',
          grade: '3',
          mbti: 'INTJ',
          birthYear: 2002,
        },
      }),
    );
    prisma.collegeMaster.findUnique.mockResolvedValue({
      code: 'HUMANITIES',
      campusCode: 'CHUNCHEON',
      nameKo: '인문대',
      isActive: true,
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

  it('SEASON_MATCHING 등록 사용자의 messageToRoommate는 season profile에만 반영한다', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(makeUser()).mockResolvedValueOnce(makeUser());
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
    seasonParticipantsService.ensureCurrentSeasonParticipantForUser.mockResolvedValue(
      makeParticipant({
        participationIntent: 'REGISTERED',
        registeredAt: new Date('2026-01-05T00:00:00.000Z'),
        participantStatus: 'DRAFT',
        profile: {
          participantId: 'participant-1',
          nicknameSnapshot: '시즌닉네임',
          nicknameNormalizedSnapshot: '시즌닉네임',
          lifestyle: makeUser().profile!.lifestyle,
          intro: '시즌 소개',
          messageToRoommate: '시즌 메시지',
          collegeCode: 'ARTS_ENGINEERING',
          grade: '3',
          mbti: 'INTJ',
          birthYear: 2002,
        },
      }),
    );

    await service.updateCurrentUser(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
        dormitoryId: null,
        dormitorySelectionState: 'NOT_SELECTED',
      },
      {
        messageToRoommate: '시즌 로컬 메시지',
      },
    );

    expect(txUserProfileUpdate).not.toHaveBeenCalled();
    expect(txSeasonParticipantProfileUpdate).toHaveBeenCalledWith({
      where: { participantId: 'participant-1' },
      data: {
        messageToRoommate: '시즌 로컬 메시지',
      },
    });
  });

  it('SEASON_POST_MATCH 등록 사용자는 현재 시즌 프로필 source를 유지하고 read-only 상태가 된다', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ profile: { nickname: '베이스닉네임' } }));
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      season: { id: 'season-1' },
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
    seasonParticipantsService.ensureCurrentSeasonParticipantForUser.mockResolvedValue(
      makeParticipant({
        participationIntent: 'REGISTERED',
        registeredAt: new Date('2026-01-05T00:00:00.000Z'),
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
        participantStatus: 'MATCHED',
        profile: {
          participantId: 'participant-1',
          nicknameSnapshot: '시즌닉네임',
          nicknameNormalizedSnapshot: '시즌닉네임',
          lifestyle: makeUser().profile!.lifestyle,
          intro: '시즌 소개',
          messageToRoommate: '시즌 메시지',
          collegeCode: 'HUMANITIES',
          grade: '4+',
          mbti: 'ENTP',
          birthYear: 2001,
        },
      }),
    );
    matchesService.getCurrentActiveMatchSummaryForParticipant.mockResolvedValue({
      id: 'active-1',
      seasonId: 'season-1',
      counterpartUserId: 'user-2',
      counterpartParticipantId: 'participant-2',
      status: 'ACTIVE',
      startedAt: new Date('2026-02-10T03:00:00.000Z').toISOString(),
      endedAt: null,
      endReason: null,
      createdFromRequestId: 'request-1',
      unmatchProgress: {
        state: 'WAITING_FOR_COUNTERPART',
        requestedByViewerAt: new Date('2026-02-10T03:01:00.000Z').toISOString(),
        requestedByCounterpartAt: null,
        progressCount: 1,
        requiredCount: 2,
        canRequest: false,
        canCancel: true,
        availableUntil: new Date('2026-02-11T14:59:59.000Z').toISOString(),
      },
    });

    const result = await service.getCurrentUser({
      id: 'user-1',
      gender: 'M',
      campus: 'CHUNCHEON',
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
    });

    expect(result.profile.source).toBe('SEASON_PARTICIPANT_PROFILE');
    expect(result.user.nickname).toBe('시즌닉네임');
    expect(result.participation.profileExists).toBe(true);
    expect(result.capabilities.profileEdit).toMatchObject({
      intro: false,
      messageToRoommate: false,
      additional: false,
      lifestyle: false,
      nickname: false,
    });
    expect(result.capabilities.canRequestMatch).toBe(false);
    expect(result.capabilities.canStartChat).toBe(false);
    expect(result.match.hasActiveMatch).toBe(true);
    expect(result.match.activeMatch?.id).toBe('active-1');
    expect(result.match.activeMatch?.counterpartUserId).toBe('user-2');
    expect(result.match.activeMatch?.unmatchProgress).toMatchObject({
      state: 'WAITING_FOR_COUNTERPART',
      progressCount: 1,
      canCancel: true,
    });
  });

  it('SEASON_POST_MATCH 등록 사용자의 profile text 수정은 거부한다', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      season: { id: 'season-1' },
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
    seasonParticipantsService.ensureCurrentSeasonParticipantForUser.mockResolvedValue(
      makeParticipant({
        participationIntent: 'REGISTERED',
        registeredAt: new Date('2026-01-05T00:00:00.000Z'),
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
        participantStatus: 'MATCHED',
        profile: {
          participantId: 'participant-1',
          nicknameSnapshot: '시즌닉네임',
          nicknameNormalizedSnapshot: '시즌닉네임',
          lifestyle: makeUser().profile!.lifestyle,
          intro: '시즌 소개',
          messageToRoommate: '시즌 메시지',
          collegeCode: 'HUMANITIES',
          grade: '4+',
          mbti: 'ENTP',
          birthYear: 2001,
        },
      }),
    );

    await expect(
      service.updateCurrentUser(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        {
          messageToRoommate: '수정 시도',
        },
      ),
    ).rejects.toMatchObject({
      response: usersErrors
        .profileFieldLocked(
          'messageToRoommate',
          '현재 시즌 상태에서는 룸메이트에게 남길 말을 수정할 수 없습니다.',
        )
        .getResponse(),
    });
  });
});

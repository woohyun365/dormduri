import { ProfilesService } from './profiles.service.js';
import { profilesErrors } from './profiles.errors.js';
import type {
  CanonicalProfileSource,
  CanonicalSelectionState,
} from '../season-participants/season-participants.service.js';
import type { UserWithProfileRecord } from './profile.mapper.js';

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
    dormitoryId: 'dasan',
    dormitorySelectionState: 'ASSIGNED',
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

type UserProfileUpdateCall = {
  where: { userId: string };
  data: Record<string, unknown>;
};

describe('ProfilesService', () => {
  const userProfileUpdate = jest.fn<Promise<void>, [UserProfileUpdateCall]>();
  const prisma = {
    getDatabaseNow: jest.fn(),
    $transaction: jest.fn(),
    campusMaster: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    userProfile: {
      findUnique: jest.fn(),
      update: userProfileUpdate,
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
    selectProfileBySource: jest.fn(),
    pickCurrentSeasonParticipant: jest.fn(),
  };

  const matchesService = {
    getLiveActiveMatchMapForParticipantIds: jest.fn(),
  };

  const service = new ProfilesService(
    prisma as never,
    seasonsService as never,
    moderationService as never,
    usersService as never,
    seasonParticipantsService as never,
    matchesService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(new Date('2026-02-10T03:00:00.000Z'));
    prisma.campusMaster.findUnique.mockResolvedValue({ isOperated: true });
    moderationService.validateNicknamePolicy.mockResolvedValue(null);
    usersService.getCurrentUser.mockResolvedValue({ success: true });
    userProfileUpdate.mockResolvedValue(undefined);
    seasonParticipantsService.ensureCurrentSeasonParticipantForUser.mockResolvedValue(null);
    matchesService.getLiveActiveMatchMapForParticipantIds.mockResolvedValue(new Map());
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
    seasonParticipantsService.pickCurrentSeasonParticipant.mockImplementation(
      (participants: Array<{ id: string }> | null | undefined) => participants?.[0] ?? null,
    );
  });

  it('SEASON_MATCHING 등록+미배정 viewer는 등록된 target만 LIMITED로 본다', async () => {
    prisma.user.findUnique.mockResolvedValue(
      makeUser({ dormitoryId: null, dormitorySelectionState: 'NOT_SELECTED' }),
    );
    prisma.user.findMany.mockResolvedValue([
      Object.assign(makeUser({ id: 'registered-target' }), {
        seasonParticipants: [
          makeParticipant({
            userId: 'registered-target',
            participationIntent: 'REGISTERED',
            registeredAt: new Date('2026-01-05T00:00:00.000Z'),
            participantStatus: 'DRAFT',
            profile: {
              participantId: 'participant-target',
              nicknameSnapshot: '시즌상대',
              nicknameNormalizedSnapshot: '시즌상대',
              lifestyle: makeUser().profile!.lifestyle,
              intro: '시즌 소개',
              messageToRoommate: '시즌 메시지',
              collegeCode: 'HUMANITIES',
              grade: '4+',
              mbti: 'ENTP',
              birthYear: 2001,
            },
          }),
        ],
      }),
      Object.assign(makeUser({ id: 'unregistered-target', profile: { nickname: '베이스상대' } }), {
        seasonParticipants: [makeParticipant({ userId: 'unregistered-target' })],
      }),
    ]);
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
        profile: { participantId: 'viewer-profile' },
      }),
    );
    seasonParticipantsService.selectCanonicalSelection
      .mockReturnValueOnce({
        dormitoryId: null,
        dormitorySelectionState: 'UNASSIGNED',
        source: 'SEASON_PARTICIPANT',
      })
      .mockReturnValueOnce({
        dormitoryId: null,
        dormitorySelectionState: 'UNASSIGNED',
        source: 'SEASON_PARTICIPANT',
      })
      .mockReturnValueOnce({
        dormitoryId: null,
        dormitorySelectionState: 'NOT_SELECTED',
        source: 'SEASON_PARTICIPANT',
      });

    const result = await service.getProfiles(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
        dormitoryId: null,
        dormitorySelectionState: 'NOT_SELECTED',
      },
      { offset: 0, limit: 20 },
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'registered-target',
      exposureLevel: 'LIMITED',
      sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
      actions: {
        canBookmark: false,
        canRequestMatch: false,
        canStartChat: false,
      },
      nickname: '시즌상대',
    });
    expect(result.items[0]).not.toHaveProperty('lifestyle');
    expect(result.items[0]).not.toHaveProperty('gender');
  });

  it('SEASON_OPEN 등록+배정 viewer는 같은 건물 등록 target을 FULL로 보고 chat만 연다', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());
    prisma.user.findUnique.mockResolvedValueOnce(makeUser()).mockResolvedValueOnce(
      Object.assign(makeUser({ id: 'peer-1', email: 'peer1@kangwon.ac.kr' }), {
        seasonParticipants: [
          makeParticipant({
            id: 'participant-target',
            userId: 'peer-1',
            participationIntent: 'REGISTERED',
            registeredAt: new Date('2026-01-05T00:00:00.000Z'),
            dormitoryId: 'dasan',
            dormitorySelectionState: 'ASSIGNED',
            participantStatus: 'ACTIVE',
            profile: {
              participantId: 'participant-target',
              nicknameSnapshot: '시즌상대',
              nicknameNormalizedSnapshot: '시즌상대',
              lifestyle: makeUser().profile!.lifestyle,
              intro: '시즌 소개',
              messageToRoommate: '시즌 메시지',
              collegeCode: 'HUMANITIES',
              grade: '4+',
              mbti: 'ENTP',
              birthYear: 2001,
            },
          }),
        ],
      }),
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
        profile: { participantId: 'viewer-profile' },
      }),
    );

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

    expect(result).toMatchObject({
      id: 'peer-1',
      exposureLevel: 'FULL',
      sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
      actions: {
        canBookmark: true,
        canRequestMatch: false,
        canStartChat: true,
      },
      nickname: '시즌상대',
    });
    expect(result).toHaveProperty('lifestyle');
    if (result.exposureLevel === 'FULL') {
      expect(result.lifestyle).not.toHaveProperty('drinkingFrequency');
      expect(result.lifestyle).not.toHaveProperty('drinkingTolerance');
    }
  });

  it('SEASON_MATCHING 등록+배정 viewer는 같은 건물 등록 target에 match/chat action을 연다', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(makeUser()).mockResolvedValueOnce(
      Object.assign(makeUser({ id: 'peer-1', email: 'peer1@kangwon.ac.kr' }), {
        seasonParticipants: [
          makeParticipant({
            id: 'participant-target',
            userId: 'peer-1',
            participationIntent: 'REGISTERED',
            registeredAt: new Date('2026-01-05T00:00:00.000Z'),
            dormitoryId: 'dasan',
            dormitorySelectionState: 'ASSIGNED',
            participantStatus: 'ACTIVE',
            profile: {
              participantId: 'participant-target',
              nicknameSnapshot: '시즌상대',
              nicknameNormalizedSnapshot: '시즌상대',
              lifestyle: makeUser().profile!.lifestyle,
              intro: '시즌 소개',
              messageToRoommate: '시즌 메시지',
              collegeCode: 'HUMANITIES',
              grade: '4+',
              mbti: 'ENTP',
              birthYear: 2001,
            },
          }),
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
    seasonParticipantsService.ensureCurrentSeasonParticipantForUser.mockResolvedValue(
      makeParticipant({
        participationIntent: 'REGISTERED',
        registeredAt: new Date('2026-01-05T00:00:00.000Z'),
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
        participantStatus: 'ACTIVE',
        profile: { participantId: 'viewer-profile' },
      }),
    );

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

    expect(result.actions).toEqual({
      canBookmark: true,
      canRequestMatch: true,
      canStartChat: true,
    });
  });

  it('live ActiveMatch가 없으면 stale MATCHED target도 같은 건물 일반 후보로 유지한다', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(makeUser()).mockResolvedValueOnce(
      Object.assign(makeUser({ id: 'peer-1', email: 'peer1@kangwon.ac.kr' }), {
        seasonParticipants: [
          makeParticipant({
            id: 'participant-target',
            userId: 'peer-1',
            participationIntent: 'REGISTERED',
            registeredAt: new Date('2026-01-05T00:00:00.000Z'),
            dormitoryId: 'dasan',
            dormitorySelectionState: 'ASSIGNED',
            participantStatus: 'MATCHED',
            matchedAt: new Date('2026-02-01T00:00:00.000Z'),
            profile: {
              participantId: 'participant-target',
              nicknameSnapshot: '시즌상대',
              nicknameNormalizedSnapshot: '시즌상대',
              lifestyle: makeUser().profile!.lifestyle,
              intro: '시즌 소개',
              messageToRoommate: '시즌 메시지',
              collegeCode: 'HUMANITIES',
              grade: '4+',
              mbti: 'ENTP',
              birthYear: 2001,
            },
          }),
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
    seasonParticipantsService.ensureCurrentSeasonParticipantForUser.mockResolvedValue(
      makeParticipant({
        participationIntent: 'REGISTERED',
        registeredAt: new Date('2026-01-05T00:00:00.000Z'),
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
        participantStatus: 'ACTIVE',
        profile: { participantId: 'viewer-profile' },
      }),
    );
    matchesService.getLiveActiveMatchMapForParticipantIds.mockResolvedValue(new Map());

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

    expect(result.exposureLevel).toBe('FULL');
    expect(result.actions).toEqual({
      canBookmark: true,
      canRequestMatch: true,
      canStartChat: true,
    });
  });

  it('SEASON_POST_MATCH matched partner는 FULL + MATCHED_PARTNER relation baseline으로 노출한다', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(makeUser()).mockResolvedValueOnce(
      Object.assign(makeUser({ id: 'peer-1', email: 'peer1@kangwon.ac.kr' }), {
        seasonParticipants: [
          makeParticipant({
            id: 'participant-target',
            userId: 'peer-1',
            participationIntent: 'REGISTERED',
            registeredAt: new Date('2026-01-05T00:00:00.000Z'),
            dormitoryId: 'dasan',
            dormitorySelectionState: 'ASSIGNED',
            participantStatus: 'MATCHED',
            profile: {
              participantId: 'participant-target',
              nicknameSnapshot: '시즌상대',
              nicknameNormalizedSnapshot: '시즌상대',
              lifestyle: makeUser().profile!.lifestyle,
              intro: '시즌 소개',
              messageToRoommate: '시즌 메시지',
              collegeCode: 'HUMANITIES',
              grade: '4+',
              mbti: 'ENTP',
              birthYear: 2001,
            },
          }),
        ],
      }),
    );
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
        profile: { participantId: 'viewer-profile' },
      }),
    );
    matchesService.getLiveActiveMatchMapForParticipantIds.mockResolvedValue(
      new Map([
        [
          'participant-1',
          {
            id: 'active-1',
            seasonId: 'season-1',
            counterpartUserId: 'peer-1',
            counterpartParticipantId: 'participant-target',
            status: 'ACTIVE',
            startedAt: new Date('2026-02-10T03:00:00.000Z').toISOString(),
            endedAt: null,
            endReason: null,
            createdFromRequestId: 'request-1',
            unmatchProgress: {
              state: 'NONE',
              requestedByViewerAt: null,
              requestedByCounterpartAt: null,
              progressCount: 0,
              requiredCount: 2,
              canRequest: false,
              canCancel: false,
              availableUntil: null,
            },
          },
        ],
        [
          'participant-target',
          {
            id: 'active-1',
            seasonId: 'season-1',
            counterpartUserId: 'user-1',
            counterpartParticipantId: 'participant-1',
            status: 'ACTIVE',
            startedAt: new Date('2026-02-10T03:00:00.000Z').toISOString(),
            endedAt: null,
            endReason: null,
            createdFromRequestId: 'request-1',
            unmatchProgress: {
              state: 'NONE',
              requestedByViewerAt: null,
              requestedByCounterpartAt: null,
              progressCount: 0,
              requiredCount: 2,
              canRequest: false,
              canCancel: false,
              availableUntil: null,
            },
          },
        ],
      ]),
    );

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

    expect(result).toMatchObject({
      exposureLevel: 'FULL',
      relationToViewer: 'MATCHED_PARTNER',
      actions: {
        canBookmark: true,
        canRequestMatch: false,
        canStartChat: false,
      },
    });
  });

  it('등록된 SEASON_OPEN 사용자의 lifestyle 수정은 잠근다', async () => {
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
      makeParticipant({
        participationIntent: 'REGISTERED',
        registeredAt: new Date('2026-01-05T00:00:00.000Z'),
        participantStatus: 'ACTIVE',
        profile: { participantId: 'participant-1' },
      }),
    );

    await expect(
      service.updateLifestyle(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        lifestylePayload,
      ),
    ).rejects.toMatchObject({
      response: profilesErrors.profileEditLocked().getResponse(),
    });
  });

  it('SEASON_POST_MATCH 등록 사용자의 lifestyle 수정은 base profile에만 반영한다', async () => {
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
        participantStatus: 'MATCHED',
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
        profile: { participantId: 'participant-1' },
      }),
    );

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

    expect(userProfileUpdate).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { lifestyle: lifestylePayload },
    });
  });

  it('미등록 SEASON_OPEN 사용자의 nickname 수정은 허용한다', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());
    prisma.userProfile.findUnique.mockResolvedValue(null);
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

    const [nicknameUpdateEntry] = userProfileUpdate.mock.calls;
    expect(nicknameUpdateEntry).toBeDefined();
    if (!nicknameUpdateEntry) {
      throw new Error('Expected nickname update call');
    }
    const [nicknameUpdateCall] = nicknameUpdateEntry;

    expect(nicknameUpdateCall).toMatchObject({
      where: { userId: 'user-1' },
      data: {
        nickname: '새닉네임',
        nicknameNormalized: '새닉네임',
      },
    });
    expect(nicknameUpdateCall.data.nicknameChangedAt).toBeInstanceOf(Date);
  });
});

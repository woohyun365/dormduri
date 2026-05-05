import { SeasonParticipantsService } from './season-participants.service.js';
import type { UserProfileRecord } from '../profiles/profile.mapper.js';

const now = new Date('2026-02-10T03:00:00.000Z');

const baseProfile: UserProfileRecord = {
  userId: 'user-1',
  nickname: '기본닉네임',
  nicknameNormalized: '기본닉네임',
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
  intro: '기본 소개',
  messageToRoommate: '기본 메시지',
  collegeCode: 'ARTS_ENGINEERING',
  grade: '3',
  mbti: 'INTJ',
  birthYear: 2002,
  createdAt: now,
  updatedAt: now,
};

describe('SeasonParticipantsService', () => {
  const prisma = {
    campusMaster: {
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    seasonParticipant: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
  };
  const seasonsService = {
    getCurrentSeasonContext: jest.fn(),
  };

  const service = new SeasonParticipantsService(prisma as never, seasonsService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('운영 캠퍼스 current season 사용자에 대해 participant row를 eager ensure한다', async () => {
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      season: { id: 'season-1' },
    });
    prisma.seasonParticipant.upsert.mockResolvedValue({
      id: 'participant-1',
      seasonId: 'season-1',
      userId: 'user-1',
      participationIntent: 'UNDECIDED',
      registeredAt: null,
      declinedAt: null,
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
      participantStatus: 'NOT_STARTED',
      campusCodeSnapshot: 'CHUNCHEON',
      genderSnapshot: 'M',
      joinedAt: now,
      activatedAt: null,
      matchedAt: null,
      withdrawnAt: null,
      expiredAt: null,
      hiddenByAdminAt: null,
      hiddenReasonCode: null,
      hiddenReasonDetail: null,
      deactivatedAt: null,
      createdAt: now,
      updatedAt: now,
      profile: null,
    });

    const result = await service.ensureCurrentSeasonParticipantForUser(
      {
        id: 'user-1',
        emailVerifiedAt: now,
        gender: 'M',
        campus: 'CHUNCHEON',
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      now,
    );

    const [callArg] = prisma.seasonParticipant.upsert.mock.calls[0] as [
      {
        where: { seasonId_userId: { seasonId: string; userId: string } };
        create: Record<string, unknown>;
      },
    ];

    expect(callArg.where).toEqual({
      seasonId_userId: {
        seasonId: 'season-1',
        userId: 'user-1',
      },
    });
    expect(callArg.create).toMatchObject({
      seasonId: 'season-1',
      userId: 'user-1',
      participationIntent: 'UNDECIDED',
      participantStatus: 'NOT_STARTED',
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
      campusCodeSnapshot: 'CHUNCHEON',
      genderSnapshot: 'M',
    });
    expect(result?.participationIntent).toBe('UNDECIDED');
    expect(result?.participantStatus).toBe('NOT_STARTED');
  });

  it('current season이 없으면 participant row를 만들지 않는다', async () => {
    seasonsService.getCurrentSeasonContext.mockResolvedValue(null);

    const result = await service.ensureCurrentSeasonParticipantForUser(
      {
        id: 'user-1',
        emailVerifiedAt: now,
        gender: 'M',
        campus: 'CHUNCHEON',
        dormitoryId: null,
        dormitorySelectionState: 'NOT_SELECTED',
      },
      now,
    );

    expect(result).toBeNull();
    expect(prisma.seasonParticipant.upsert).not.toHaveBeenCalled();
  });

  it('participant profile이 있으면 current season canonical profile source로 선택한다', () => {
    const result = service.selectCanonicalProfile(baseProfile, {
      participantId: 'participant-1',
      nicknameSnapshot: '시즌닉네임',
      nicknameNormalizedSnapshot: '시즌닉네임',
      lifestyle: {
        ...(baseProfile.lifestyle as Record<string, unknown>),
        relationshipStyle: 'DISTANT',
      },
      intro: '시즌 소개',
      messageToRoommate: '시즌 메시지',
      collegeCode: 'HUMANITIES',
      grade: '4+',
      mbti: 'ENTP',
      birthYear: 2001,
      templateSourceUserProfileUpdatedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    expect(result).toMatchObject({
      source: 'season-participant-profile',
      nickname: '시즌닉네임',
      intro: '시즌 소개',
      messageToRoommate: '시즌 메시지',
      collegeCode: 'HUMANITIES',
    });
  });

  it('backfill은 운영 캠퍼스의 current season + verified user만 대상으로 삼는다', async () => {
    prisma.campusMaster.findMany.mockResolvedValue([{ code: 'CHUNCHEON' }, { code: 'SAMCHEOK' }]);
    seasonsService.getCurrentSeasonContext
      .mockResolvedValueOnce({ season: { id: 'season-current' } })
      .mockResolvedValueOnce(null);
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'user-1',
        emailVerifiedAt: now,
        gender: 'M',
        campus: 'CHUNCHEON',
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      {
        id: 'user-2',
        emailVerifiedAt: now,
        gender: 'F',
        campus: 'CHUNCHEON',
        dormitoryId: null,
        dormitorySelectionState: 'NOT_SELECTED',
      },
    ]);
    prisma.seasonParticipant.findMany.mockResolvedValue([{ userId: 'user-2' }]);
    prisma.seasonParticipant.createMany.mockResolvedValue({ count: 1 });

    const result = await service.backfillCurrentSeasonParticipants(now);

    expect(prisma.seasonParticipant.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          seasonId: 'season-current',
          userId: 'user-1',
          participationIntent: 'UNDECIDED',
          participantStatus: 'NOT_STARTED',
        }),
      ],
      skipDuplicates: true,
    });
    expect(result).toEqual([
      {
        campus: 'CHUNCHEON',
        seasonId: 'season-current',
        eligibleUserCount: 2,
        createdCount: 1,
        existingCount: 1,
      },
    ]);
  });
});

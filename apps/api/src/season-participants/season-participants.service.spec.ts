import { SeasonParticipantsService } from './season-participants.service.js';
import { seasonParticipantsErrors } from './season-participants.errors.js';
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

type SeasonParticipantUpdateCall = {
  where: { id: string };
  data: Record<string, unknown>;
};
type SeasonParticipantProfileUpsertCall = {
  where: { participantId: string };
  create: Record<string, unknown>;
  update: Record<string, unknown>;
};
type UserUpdateCall = {
  where: { id: string };
  data: Record<string, unknown>;
};

describe('SeasonParticipantsService', () => {
  const txSeasonParticipantUpdate = jest.fn<Promise<void>, [SeasonParticipantUpdateCall]>();
  const txSeasonParticipantProfileUpsert = jest.fn<
    Promise<void>,
    [SeasonParticipantProfileUpsertCall]
  >();
  const txUserUpdate = jest.fn<Promise<void>, [UserUpdateCall]>();
  const prisma = {
    getDatabaseNow: jest.fn(),
    $transaction: jest.fn(),
    campusMaster: {
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    seasonParticipant: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const seasonsService = {
    getCurrentSeasonContext: jest.fn(),
  };

  const service = new SeasonParticipantsService(prisma as never, seasonsService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(now);
    prisma.$transaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback({
        seasonParticipant: { update: txSeasonParticipantUpdate },
        seasonParticipantProfile: { upsert: txSeasonParticipantProfileUpsert },
        user: { update: txUserUpdate },
      }),
    );
    txSeasonParticipantUpdate.mockResolvedValue(undefined);
    txSeasonParticipantProfileUpsert.mockResolvedValue(undefined);
    txUserUpdate.mockResolvedValue(undefined);
  });

  it('운영 캠퍼스 current season 사용자에 대해 participant row를 eager ensure한다', async () => {
    seasonsService.getCurrentSeasonContext.mockResolvedValue({ season: { id: 'season-1' } });
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

    expect(prisma.seasonParticipant.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          seasonId_userId: {
            seasonId: 'season-1',
            userId: 'user-1',
          },
        },
      }),
    );
    expect(result?.participationIntent).toBe('UNDECIDED');
  });

  it('register는 NOT_SELECTED를 UNASSIGNED로 정규화하고 시즌 프로필 스냅샷을 만든다', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      emailVerifiedAt: now,
      gender: 'M',
      campus: 'CHUNCHEON',
      dormitoryId: null,
      dormitorySelectionState: 'NOT_SELECTED',
      profile: baseProfile,
    });
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      season: { id: 'season-1' },
      state: 'SEASON_OPEN',
    });
    prisma.seasonParticipant.upsert.mockResolvedValue({
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
    prisma.seasonParticipant.findUnique.mockResolvedValue({
      id: 'participant-1',
      seasonId: 'season-1',
      userId: 'user-1',
      participationIntent: 'REGISTERED',
      registeredAt: now,
      declinedAt: null,
      dormitoryId: null,
      dormitorySelectionState: 'UNASSIGNED',
      participantStatus: 'DRAFT',
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
      profile: { participantId: 'participant-1' },
    });

    const result = await service.registerCurrentSeasonParticipation('user-1', now);

    const [seasonParticipantUpdateEntry] = txSeasonParticipantUpdate.mock.calls;
    expect(seasonParticipantUpdateEntry).toBeDefined();
    if (!seasonParticipantUpdateEntry) {
      throw new Error('Expected participant update call');
    }
    const [seasonParticipantUpdateCall] = seasonParticipantUpdateEntry;
    expect(seasonParticipantUpdateCall).toMatchObject({
      where: { id: 'participant-1' },
      data: {
        participationIntent: 'REGISTERED',
        dormitorySelectionState: 'UNASSIGNED',
        dormitoryId: null,
        participantStatus: 'DRAFT',
      },
    });
    const [seasonParticipantProfileUpsertEntry] = txSeasonParticipantProfileUpsert.mock.calls;
    expect(seasonParticipantProfileUpsertEntry).toBeDefined();
    if (!seasonParticipantProfileUpsertEntry) {
      throw new Error('Expected participant profile upsert call');
    }
    const [seasonParticipantProfileUpsertCall] = seasonParticipantProfileUpsertEntry;
    expect(seasonParticipantProfileUpsertCall).toMatchObject({
      where: { participantId: 'participant-1' },
      create: {
        participantId: 'participant-1',
        nicknameSnapshot: '기본닉네임',
        intro: '기본 소개',
      },
      update: {
        nicknameSnapshot: '기본닉네임',
        intro: '기본 소개',
      },
    });
    expect(txUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        dormitorySelectionState: 'UNASSIGNED',
        dormitoryId: null,
      },
    });
    expect(result.participationIntent).toBe('REGISTERED');
    expect(result.dormitorySelectionState).toBe('UNASSIGNED');
  });

  it('register는 ASSIGNED 상태면 ACTIVE로 올리고 activatedAt을 남긴다', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      emailVerifiedAt: now,
      gender: 'M',
      campus: 'CHUNCHEON',
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
      profile: baseProfile,
    });
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      season: { id: 'season-1' },
      state: 'SEASON_MATCHING',
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
    prisma.seasonParticipant.findUnique.mockResolvedValue({
      id: 'participant-1',
      seasonId: 'season-1',
      userId: 'user-1',
      participationIntent: 'REGISTERED',
      registeredAt: now,
      declinedAt: null,
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
      participantStatus: 'ACTIVE',
      campusCodeSnapshot: 'CHUNCHEON',
      genderSnapshot: 'M',
      joinedAt: now,
      activatedAt: now,
      matchedAt: null,
      withdrawnAt: null,
      expiredAt: null,
      hiddenByAdminAt: null,
      hiddenReasonCode: null,
      hiddenReasonDetail: null,
      deactivatedAt: null,
      createdAt: now,
      updatedAt: now,
      profile: { participantId: 'participant-1' },
    });

    await service.registerCurrentSeasonParticipation('user-1', now);

    const [activeParticipantUpdateEntry] = txSeasonParticipantUpdate.mock.calls;
    expect(activeParticipantUpdateEntry).toBeDefined();
    if (!activeParticipantUpdateEntry) {
      throw new Error('Expected active participant update call');
    }
    const [seasonParticipantUpdateCall] = activeParticipantUpdateEntry;
    expect(seasonParticipantUpdateCall).toMatchObject({
      where: { id: 'participant-1' },
      data: {
        dormitorySelectionState: 'ASSIGNED',
        dormitoryId: 'dasan',
        participantStatus: 'ACTIVE',
        activatedAt: now,
      },
    });
  });

  it('SEASON_POST_MATCH에서는 register를 거부한다', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      emailVerifiedAt: now,
      gender: 'M',
      campus: 'CHUNCHEON',
      dormitoryId: null,
      dormitorySelectionState: 'NOT_SELECTED',
      profile: baseProfile,
    });
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      season: { id: 'season-1' },
      state: 'SEASON_POST_MATCH',
    });

    await expect(service.registerCurrentSeasonParticipation('user-1', now)).rejects.toMatchObject({
      response: seasonParticipantsErrors.registrationNotAllowed().getResponse(),
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

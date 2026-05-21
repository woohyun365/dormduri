import { updateCurrentUserRequestSchema } from '@repo/shared/user-contract';
import type { SeasonProfileDraftRequest } from '@repo/shared/season-contract';
import { SeasonParticipantsService } from './season-participants.service.js';
import { seasonParticipantsErrors } from './season-participants.errors.js';
import { toLifestyleColumnData } from '../profiles/profile-lifestyle.persistence.js';

const now = new Date('2026-02-10T03:00:00.000Z');
const later = new Date('2026-02-11T03:00:00.000Z');

function objectContaining(shape: Record<string, unknown>): unknown {
  return expect.objectContaining(shape) as unknown;
}

function anyObject(): unknown {
  return expect.any(Object) as unknown;
}

const completeLifestyle = {
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
  smokingTolerance: 'NO_ONLY',
  phoneTolerance: 'BRIEF_OK',
  earphoneExpectation: 'MUST',
  sleepEnvPreference: 'NO_SPEAKER',
  screenTolerance: 'LOW_OK',
  indoorEatingTolerance: 'NO_SMELL',
  cleanExpectation: 'STRICT',
  drinkingTolerance: 'LOW_ONLY',
} as const;

const draftInput: SeasonProfileDraftRequest = {
  lifestyle: completeLifestyle,
  intro: '시즌 소개',
  additional: {
    college: 'ARTS_ENGINEERING',
    grade: '3',
    mbti: 'INTJ',
    birthYear: 2002,
  },
};

function seasonContext(overrides: Record<string, unknown> = {}) {
  return {
    season: { id: 'season-1' },
    state: 'SEASON_OPEN',
    operatedDormitories: [
      { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-02-20' },
    ],
    schedule: {
      preparationStart: '2026-01-01',
      matchingStart: '2026-02-01',
      matchingEnd: '2026-02-20',
      seasonEnd: '2026-03-01',
    },
    ...overrides,
  };
}

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    campus: 'CHUNCHEON',
    gender: 'M',
    emailVerifiedAt: now,
    deletedAt: null,
    displayIdentity: {
      userId: 'user-1',
      nickname: '현재닉네임',
      nicknameNormalized: '현재닉네임',
    },
    ...overrides,
  };
}

function profile(overrides: Record<string, unknown> = {}) {
  return {
    participantId: 'participant-1',
    nicknameSnapshot: '현재닉네임',
    nicknameNormalizedSnapshot: '현재닉네임',
    ...toLifestyleColumnData(completeLifestyle),
    intro: '시즌 소개',
    collegeCode: 'ARTS_ENGINEERING',
    grade: '3',
    mbti: 'INTJ',
    birthYear: 2002,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function participant(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
}

describe('SeasonParticipantsService Step 5', () => {
  const txUserFindUnique = jest.fn();
  const txSeasonParticipantUpsert = jest.fn();
  const txSeasonParticipantUpdate = jest.fn();
  const txSeasonParticipantFindUnique = jest.fn();
  const txSeasonParticipantProfileUpsert = jest.fn();
  const txSeasonParticipantProfileUpdate = jest.fn();
  const txSeasonParticipantProfileHistoryCreate = jest.fn();
  const txSeasonDormitoryOperationFindUnique = jest.fn();
  const tx = {
    user: { findUnique: txUserFindUnique },
    seasonParticipant: {
      upsert: txSeasonParticipantUpsert,
      update: txSeasonParticipantUpdate,
      findUnique: txSeasonParticipantFindUnique,
    },
    seasonParticipantProfile: {
      upsert: txSeasonParticipantProfileUpsert,
      update: txSeasonParticipantProfileUpdate,
    },
    seasonParticipantProfileHistory: { create: txSeasonParticipantProfileHistoryCreate },
    seasonDormitoryOperation: { findUnique: txSeasonDormitoryOperationFindUnique },
    matchRequest: { updateMany: jest.fn() },
    conversationThread: { updateMany: jest.fn() },
  };
  const prisma = {
    getDatabaseNow: jest.fn(),
    runSerializableTransaction: jest.fn(),
    campusMaster: { findMany: jest.fn() },
    user: { findMany: jest.fn(), findUnique: jest.fn() },
    seasonParticipant: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      createMany: jest.fn(),
      findUnique: jest.fn(),
    },
    seasonDormitoryOperation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    activeMatch: { findFirst: jest.fn() },
  };
  const seasonsService = { getCurrentSeasonContext: jest.fn() };
  const service = new SeasonParticipantsService(prisma as never, seasonsService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(now);
    prisma.runSerializableTransaction.mockImplementation((callback: (txArg: unknown) => unknown) =>
      callback(tx),
    );
    prisma.user.findUnique.mockResolvedValue(user());
    txUserFindUnique.mockResolvedValue(user());
    seasonsService.getCurrentSeasonContext.mockResolvedValue(seasonContext());
    prisma.seasonParticipant.upsert.mockResolvedValue(participant());
    txSeasonParticipantUpsert.mockResolvedValue(participant());
    txSeasonParticipantUpdate.mockResolvedValue(undefined);
    txSeasonParticipantProfileUpsert.mockResolvedValue(undefined);
    txSeasonParticipantProfileUpdate.mockResolvedValue(undefined);
    txSeasonParticipantProfileHistoryCreate.mockResolvedValue({
      id: 'history-1',
      registeredAtSnapshot: now,
    });
    txSeasonDormitoryOperationFindUnique.mockResolvedValue({
      seasonId: 'season-1',
      dormitoryId: 'dasan',
      isOperated: true,
      roomSelectionDate: later,
      dormitory: {
        id: 'dasan',
        campusCode: 'CHUNCHEON',
        nameKo: '다산관',
        roomType: 2,
        genderPolicy: 'M',
      },
    });
    txSeasonParticipantFindUnique.mockResolvedValue(
      participant({
        participationIntent: 'REGISTERED',
        registeredAt: now,
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
        participantStatus: 'ACTIVE',
        activatedAt: now,
        profile: profile(),
      }),
    );
    prisma.seasonParticipant.findUnique.mockResolvedValue(participant({ profile: profile() }));
    prisma.seasonDormitoryOperation.findMany.mockResolvedValue([
      {
        seasonId: 'season-1',
        dormitoryId: 'dasan',
        isOperated: true,
        roomSelectionDate: later,
        dormitory: {
          id: 'dasan',
          campusCode: 'CHUNCHEON',
          nameKo: '다산관',
          roomType: 2,
          genderPolicy: 'M',
        },
      },
    ]);
  });

  it('ensureCurrentSeasonParticipant()는 row/container만 보장하고 registered/assigned/history를 만들지 않는다', async () => {
    const result = await service.ensureCurrentSeasonParticipant(
      { id: 'user-1', emailVerifiedAt: now, gender: 'M', campus: 'CHUNCHEON' },
      now,
    );

    expect(prisma.seasonParticipant.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: objectContaining({
          participationIntent: 'UNDECIDED',
          dormitorySelectionState: 'NOT_SELECTED',
          dormitoryId: null,
          participantStatus: 'NOT_STARTED',
        }),
        update: {},
      }),
    );
    expect(txSeasonParticipantUpdate).not.toHaveBeenCalled();
    expect(txSeasonParticipantProfileHistoryCreate).not.toHaveBeenCalled();
    expect(result?.participationIntent).toBe('UNDECIDED');
  });

  it('createOrUpdateSeasonProfileDraft()는 draft current row만 쓰고 history를 만들지 않는다', async () => {
    const response = await service.createOrUpdateSeasonProfileDraft('user-1', draftInput, now);

    expect(txSeasonParticipantProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { participantId: 'participant-1' },
        create: objectContaining({
          participantId: 'participant-1',
          nicknameSnapshot: '현재닉네임',
          intro: '시즌 소개',
          collegeCode: 'ARTS_ENGINEERING',
        }),
        update: objectContaining({
          nicknameSnapshot: '현재닉네임',
          intro: '시즌 소개',
        }),
      }),
    );
    expect(txSeasonParticipantUpdate).not.toHaveBeenCalled();
    expect(txSeasonParticipantProfileHistoryCreate).not.toHaveBeenCalled();
    expect(response.state).toBe('COMPLETE');
  });

  it('getCurrentSeasonProfile()은 participant row를 생성하지 않고 빈 draft state를 반환한다', async () => {
    prisma.seasonParticipant.findUnique.mockResolvedValueOnce(null);

    const response = await service.getCurrentSeasonProfile('user-1', now);

    expect(prisma.seasonParticipant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          seasonId_userId: {
            seasonId: 'season-1',
            userId: 'user-1',
          },
        },
      }),
    );
    expect(prisma.seasonParticipant.upsert).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      participantId: null,
      seasonId: 'season-1',
      state: 'NONE',
      draftWritable: true,
    });
    expect(response.completion.registrationUnavailableReasons).toEqual(
      expect.arrayContaining(['PROFILE_INCOMPLETE', 'DORMITORY_SELECTION_REQUIRED']),
    );
  });

  it('getCurrentSeasonProfile()은 SEASON_POST_MATCH에서도 read-only로 조회하고 draft write는 닫는다', async () => {
    seasonsService.getCurrentSeasonContext.mockResolvedValueOnce(
      seasonContext({ state: 'SEASON_POST_MATCH' }),
    );
    prisma.seasonParticipant.findUnique.mockResolvedValueOnce(participant({ profile: profile() }));

    const response = await service.getCurrentSeasonProfile('user-1', now);

    expect(prisma.seasonParticipant.upsert).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      participantId: 'participant-1',
      seasonId: 'season-1',
      state: 'COMPLETE',
      draftWritable: false,
    });
    expect(response.completion.registrationUnavailableReasons).toContain('SEASON_NOT_OPEN');
  });

  it('registration 후 profile draft 수정은 거부한다', async () => {
    txSeasonParticipantUpsert.mockResolvedValue(
      participant({
        participationIntent: 'REGISTERED',
        registeredAt: now,
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
        participantStatus: 'ACTIVE',
        profile: profile(),
      }),
    );

    await expect(
      service.createOrUpdateSeasonProfileDraft('user-1', draftInput, now),
    ).rejects.toMatchObject({
      response: seasonParticipantsErrors.seasonProfileDraftNotAllowed().getResponse(),
    });
    expect(txSeasonParticipantProfileUpsert).not.toHaveBeenCalled();
  });

  it('incomplete profile이어도 건물 선택 저장은 가능하지만 registration finalize는 거부한다', async () => {
    const incompleteParticipant = participant({ profile: profile({ drinkingTolerance: null }) });
    prisma.seasonParticipant.findUnique.mockResolvedValue(incompleteParticipant);
    txSeasonParticipantUpsert.mockResolvedValue(incompleteParticipant);
    txSeasonParticipantUpdate.mockResolvedValueOnce(
      participant({
        profile: profile({ drinkingTolerance: null }),
        dormitorySelectionState: 'SELECTED',
        dormitoryId: 'dasan',
        participantStatus: 'DRAFT',
      }),
    );

    const selectable = await service.listSelectableDormitoriesForCurrentSeason('user-1', now);
    expect(selectable.items).toEqual([
      expect.objectContaining({ id: 'dasan', name: '다산관', campusCode: 'CHUNCHEON' }),
    ]);
    expect(selectable.completion.registrationUnavailableReasons).toContain('PROFILE_INCOMPLETE');

    await expect(
      service.createOrUpdateDormitorySelection('user-1', { dormitoryId: 'dasan' }, now),
    ).resolves.toMatchObject({
      dormitorySelectionState: 'SELECTED',
      dormitoryId: 'dasan',
    });
    expect(txSeasonParticipantProfileHistoryCreate).not.toHaveBeenCalled();
    jest.clearAllMocks();
    txUserFindUnique.mockResolvedValue(user());
    seasonsService.getCurrentSeasonContext.mockResolvedValue(seasonContext());
    txSeasonParticipantUpsert.mockResolvedValue(incompleteParticipant);

    await expect(service.finalizeSeasonRegistration('user-1', now)).rejects.toMatchObject({
      response: seasonParticipantsErrors.registrationSeasonProfileIncomplete().getResponse(),
    });
    expect(txSeasonParticipantUpdate).not.toHaveBeenCalled();
    expect(txSeasonParticipantProfileHistoryCreate).not.toHaveBeenCalled();
  });

  it('registration 후에는 dormitory selection 변경도 거부한다', async () => {
    txSeasonParticipantUpsert.mockResolvedValue(
      participant({
        participationIntent: 'REGISTERED',
        registeredAt: now,
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
        participantStatus: 'ACTIVE',
        profile: profile(),
      }),
    );

    await expect(
      service.createOrUpdateDormitorySelection('user-1', { dormitoryId: 'other-dormitory' }, now),
    ).rejects.toMatchObject({
      response: seasonParticipantsErrors.dormitorySelectionInvalid().getResponse(),
    });
    expect(txSeasonParticipantUpdate).not.toHaveBeenCalled();
  });

  it('complete profile 상태에서도 현재 시즌의 본인 campus/gender 기준 selectable dormitory list를 반환한다', async () => {
    prisma.seasonParticipant.findUnique.mockResolvedValue(participant({ profile: profile() }));

    const result = await service.listSelectableDormitoriesForCurrentSeason('user-1', now);

    expect(prisma.seasonParticipant.upsert).not.toHaveBeenCalled();
    expect(prisma.seasonDormitoryOperation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: objectContaining({
          seasonId: 'season-1',
          isOperated: true,
          dormitory: objectContaining({
            campusCode: 'CHUNCHEON',
            genderPolicy: { in: ['M', 'BOTH'] },
          }),
        }),
      }),
    );
    expect(result.items).toEqual([
      expect.objectContaining({ id: 'dasan', name: '다산관', campusCode: 'CHUNCHEON' }),
    ]);
  });

  it('incomplete profile 상태여도 현재 시즌의 본인 campus/gender 기준 selectable dormitory list를 반환한다', async () => {
    prisma.seasonParticipant.findUnique.mockResolvedValue(
      participant({ profile: profile({ drinkingTolerance: null }) }),
    );

    const result = await service.listSelectableDormitoriesForCurrentSeason('user-1', now);

    expect(prisma.seasonParticipant.upsert).not.toHaveBeenCalled();
    expect(prisma.seasonDormitoryOperation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: objectContaining({
          seasonId: 'season-1',
          isOperated: true,
          dormitory: objectContaining({
            campusCode: 'CHUNCHEON',
            genderPolicy: { in: ['M', 'BOTH'] },
          }),
        }),
      }),
    );
    expect(result).toMatchObject({
      profileState: 'DRAFT',
      items: [expect.objectContaining({ id: 'dasan', campusCode: 'CHUNCHEON' })],
    });
    expect(result.completion.registrationUnavailableReasons).toContain('PROFILE_INCOMPLETE');
  });

  it('participant row가 없어도 selectable dormitory list는 사용자 snapshot 기준으로 read-only 조회한다', async () => {
    prisma.seasonParticipant.findUnique.mockResolvedValueOnce(null);

    const result = await service.listSelectableDormitoriesForCurrentSeason('user-1', now);

    expect(prisma.seasonParticipant.upsert).not.toHaveBeenCalled();
    expect(prisma.seasonDormitoryOperation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: objectContaining({
          dormitory: objectContaining({
            campusCode: 'CHUNCHEON',
            genderPolicy: { in: ['M', 'BOTH'] },
          }),
        }),
      }),
    );
    expect(result).toMatchObject({
      profileState: 'NONE',
      items: [expect.objectContaining({ id: 'dasan' })],
    });
    expect(result.completion.registrationUnavailableReasons).toEqual(
      expect.arrayContaining(['PROFILE_INCOMPLETE', 'DORMITORY_SELECTION_REQUIRED']),
    );
  });

  it('건물 선택 전 finalize는 registration 완료로 진행하지 않는다', async () => {
    txSeasonParticipantUpsert.mockResolvedValue(participant({ profile: profile() }));

    await expect(service.finalizeSeasonRegistration('user-1', now)).rejects.toMatchObject({
      response: seasonParticipantsErrors.registrationNotAllowed().getResponse(),
    });
    expect(txSeasonParticipantUpdate).not.toHaveBeenCalled();
    expect(txSeasonParticipantProfileHistoryCreate).not.toHaveBeenCalled();
  });

  it('createOrUpdateDormitorySelection()는 등록 전 선택만 저장하고 변경 가능하며 history를 만들지 않는다', async () => {
    txSeasonParticipantUpsert.mockResolvedValue(
      participant({
        dormitorySelectionState: 'SELECTED',
        dormitoryId: 'old-dormitory',
        participantStatus: 'DRAFT',
        profile: profile(),
      }),
    );
    txSeasonParticipantUpdate.mockResolvedValueOnce(
      participant({
        dormitorySelectionState: 'SELECTED',
        dormitoryId: 'dasan',
        participantStatus: 'DRAFT',
        profile: profile(),
      }),
    );

    const result = await service.createOrUpdateDormitorySelection(
      'user-1',
      { dormitoryId: 'dasan' },
      now,
    );

    expect(txSeasonParticipantUpdate).toHaveBeenCalledWith({
      where: { id: 'participant-1' },
      data: objectContaining({
        dormitorySelectionState: 'SELECTED',
        dormitoryId: 'dasan',
        participantStatus: 'DRAFT',
      }),
      select: anyObject(),
    });
    expect(txSeasonParticipantProfileHistoryCreate).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      dormitorySelectionState: 'SELECTED',
      dormitoryId: 'dasan',
      profileState: 'COMPLETE',
    });
  });

  it('dormitory validation은 operated/campus/gender/cutoff/no selectable 조건을 닫는다', async () => {
    txSeasonParticipantUpsert.mockResolvedValue(participant({ profile: profile() }));

    txSeasonDormitoryOperationFindUnique.mockResolvedValueOnce(null);
    await expect(
      service.createOrUpdateDormitorySelection('user-1', { dormitoryId: 'missing' }, now),
    ).rejects.toMatchObject({
      response: seasonParticipantsErrors.dormitorySelectionInvalid().getResponse(),
    });

    txSeasonDormitoryOperationFindUnique.mockResolvedValueOnce({
      seasonId: 'season-1',
      dormitoryId: 'samcheok',
      isOperated: true,
      roomSelectionDate: later,
      dormitory: {
        id: 'samcheok',
        campusCode: 'SAMCHEOK',
        nameKo: '삼척관',
        roomType: 2,
        genderPolicy: 'M',
      },
    });
    await expect(
      service.createOrUpdateDormitorySelection('user-1', { dormitoryId: 'samcheok' }, now),
    ).rejects.toMatchObject({
      response: seasonParticipantsErrors.dormitorySelectionInvalid().getResponse(),
    });

    txSeasonDormitoryOperationFindUnique.mockResolvedValueOnce({
      seasonId: 'season-1',
      dormitoryId: 'female-only',
      isOperated: true,
      roomSelectionDate: later,
      dormitory: {
        id: 'female-only',
        campusCode: 'CHUNCHEON',
        nameKo: '여성관',
        roomType: 2,
        genderPolicy: 'F',
      },
    });
    await expect(
      service.createOrUpdateDormitorySelection('user-1', { dormitoryId: 'female-only' }, now),
    ).rejects.toMatchObject({
      response: seasonParticipantsErrors.dormitorySelectionInvalid().getResponse(),
    });

    seasonsService.getCurrentSeasonContext.mockResolvedValue(
      seasonContext({ state: 'SEASON_MATCHING' }),
    );
    txSeasonDormitoryOperationFindUnique.mockResolvedValueOnce({
      seasonId: 'season-1',
      dormitoryId: 'closed',
      isOperated: true,
      roomSelectionDate: new Date('2026-02-01T00:00:00.000Z'),
      dormitory: {
        id: 'closed',
        campusCode: 'CHUNCHEON',
        nameKo: '마감관',
        roomType: 2,
        genderPolicy: 'M',
      },
    });
    await expect(
      service.createOrUpdateDormitorySelection('user-1', { dormitoryId: 'closed' }, now),
    ).rejects.toMatchObject({
      response: seasonParticipantsErrors.dormitorySelectionInvalid().getResponse(),
    });

    prisma.seasonParticipant.findUnique.mockResolvedValueOnce(participant({ profile: profile() }));
    prisma.seasonDormitoryOperation.findMany.mockResolvedValueOnce([]);
    const noSelectable = await service.listSelectableDormitoriesForCurrentSeason('user-1', now);
    expect(noSelectable.completion.registrationUnavailableReasons).toContain(
      'NO_SELECTABLE_DORMITORY',
    );
  });

  it('profile incomplete 상태에서도 selectable dormitory 부재 사유를 함께 노출한다', async () => {
    prisma.seasonParticipant.findUnique.mockResolvedValueOnce(
      participant({ profile: profile({ drinkingTolerance: null }) }),
    );
    prisma.seasonDormitoryOperation.findMany.mockResolvedValueOnce([]);

    const response = await service.listSelectableDormitoriesForCurrentSeason('user-1', now);

    expect(response.completion.registrationUnavailableReasons).toEqual(
      expect.arrayContaining([
        'PROFILE_INCOMPLETE',
        'DORMITORY_SELECTION_REQUIRED',
        'NO_SELECTABLE_DORMITORY',
      ]),
    );
  });

  it('finalizeSeasonRegistration()만 registered/assigned/history를 생성한다', async () => {
    txSeasonParticipantUpsert.mockResolvedValue(
      participant({
        dormitorySelectionState: 'SELECTED',
        dormitoryId: 'dasan',
        participantStatus: 'DRAFT',
        profile: profile(),
      }),
    );

    const result = await service.finalizeSeasonRegistration('user-1', now);

    expect(txSeasonParticipantUpdate).toHaveBeenCalledWith({
      where: { id: 'participant-1' },
      data: objectContaining({
        participationIntent: 'REGISTERED',
        registeredAt: now,
        dormitorySelectionState: 'ASSIGNED',
        dormitoryId: 'dasan',
        participantStatus: 'ACTIVE',
      }),
    });
    expect(txSeasonParticipantProfileUpdate).toHaveBeenCalledWith({
      where: { participantId: 'participant-1' },
      data: {
        nicknameSnapshot: '현재닉네임',
        nicknameNormalizedSnapshot: '현재닉네임',
      },
    });
    expect(txSeasonParticipantProfileHistoryCreate).toHaveBeenCalledWith({
      data: objectContaining({
        participantId: 'participant-1',
        seasonId: 'season-1',
        source: 'SEASON_REGISTRATION',
        registeredAtSnapshot: now,
      }),
      select: { id: true, registeredAtSnapshot: true },
    });
    expect(result).toMatchObject({
      participationIntent: 'REGISTERED',
      dormitorySelectionState: 'ASSIGNED',
      dormitoryId: 'dasan',
      profileHistoryId: 'history-1',
    });
  });

  it('withdrawn/declined 재등록은 거부한다', async () => {
    txSeasonParticipantUpsert.mockResolvedValue(
      participant({
        participationIntent: 'DECLINED',
        declinedAt: now,
        participantStatus: 'WITHDRAWN',
        withdrawnAt: now,
        profile: profile(),
      }),
    );

    await expect(service.finalizeSeasonRegistration('user-1', now)).rejects.toMatchObject({
      response: seasonParticipantsErrors.registrationNotAllowed().getResponse(),
    });
    expect(txSeasonParticipantUpdate).not.toHaveBeenCalled();
  });

  it('PATCH /api/users/me에는 selection write path가 없다', () => {
    expect(
      updateCurrentUserRequestSchema.safeParse({ selection: { dormitoryId: 'dasan' } }).success,
    ).toBe(false);
  });
});

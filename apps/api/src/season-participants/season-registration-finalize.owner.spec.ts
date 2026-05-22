import { seasonParticipantsErrors } from './season-participants.errors.js';
import {
  createSeasonParticipantsServiceTestKit,
  now,
  objectContaining,
  participant,
  profile,
  seasonRuntimeRow,
} from './season-participants.owner.spec-fixtures.js';

describe('season-registration-finalize.owner', () => {
  it('건물 선택 전 finalize는 registration 완료로 진행하지 않는다', async () => {
    const {
      service,
      txSeasonParticipantUpsert,
      txSeasonParticipantUpdate,
      txSeasonParticipantProfileHistoryCreate,
    } = createSeasonParticipantsServiceTestKit();
    txSeasonParticipantUpsert.mockResolvedValue(participant({ profile: profile() }));

    await expect(service.finalizeSeasonRegistration('user-1', now)).rejects.toMatchObject({
      response: seasonParticipantsErrors.registrationNotAllowed().getResponse(),
    });
    expect(txSeasonParticipantUpdate).not.toHaveBeenCalled();
    expect(txSeasonParticipantProfileHistoryCreate).not.toHaveBeenCalled();
  });

  it('incomplete profile이어도 건물 선택 저장은 가능하지만 registration finalize는 거부한다', async () => {
    const {
      service,
      prisma,
      seasonsService,
      txUserFindUnique,
      txSeasonParticipantUpsert,
      txSeasonParticipantUpdate,
      txSeasonParticipantProfileHistoryCreate,
    } = createSeasonParticipantsServiceTestKit();
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

    await expect(
      service.createOrUpdateDormitorySelection('user-1', { dormitoryId: 'dasan' }, now),
    ).resolves.toMatchObject({
      dormitorySelectionState: 'SELECTED',
      dormitoryId: 'dasan',
    });
    expect(txSeasonParticipantProfileHistoryCreate).not.toHaveBeenCalled();

    jest.clearAllMocks();
    txUserFindUnique.mockResolvedValue({
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
    });
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
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
    });
    txSeasonParticipantUpsert.mockResolvedValue(incompleteParticipant);

    await expect(service.finalizeSeasonRegistration('user-1', now)).rejects.toMatchObject({
      response: seasonParticipantsErrors.registrationSeasonProfileIncomplete().getResponse(),
    });
    expect(txSeasonParticipantUpdate).not.toHaveBeenCalled();
    expect(txSeasonParticipantProfileHistoryCreate).not.toHaveBeenCalled();
  });

  it('finalizeSeasonRegistration()만 registered/assigned/history를 생성한다', async () => {
    const {
      service,
      tx,
      txSeasonParticipantUpsert,
      txSeasonParticipantUpdate,
      txSeasonParticipantProfileUpdate,
      txSeasonParticipantProfileHistoryCreate,
      dormitoriesService,
    } = createSeasonParticipantsServiceTestKit();
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
    expect(dormitoriesService.validateSelectableDormitoryForSeasonParticipant).toHaveBeenCalledWith(
      expect.objectContaining({
        seasonContext: objectContaining({
          season: expect.objectContaining({ id: 'season-1' }),
        }),
        campusCodeSnapshot: 'CHUNCHEON',
        genderSnapshot: 'M',
        dormitoryId: 'dasan',
        now,
        queryClient: tx,
      }),
    );
  });

  it('finalize는 transaction 내부에서 season context를 재조회한 seasonId로 participant와 dormitory validation을 수행한다', async () => {
    const { service, tx, txSeasonFindMany, txSeasonParticipantUpsert, dormitoriesService } =
      createSeasonParticipantsServiceTestKit();
    txSeasonFindMany.mockResolvedValueOnce([seasonRuntimeRow({ id: 'season-tx' })]);
    txSeasonParticipantUpsert.mockResolvedValue(
      participant({
        seasonId: 'season-tx',
        dormitorySelectionState: 'SELECTED',
        dormitoryId: 'dasan',
        participantStatus: 'DRAFT',
        profile: profile(),
      }),
    );

    await service.finalizeSeasonRegistration('user-1', now);

    expect(txSeasonParticipantUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          seasonId_userId: {
            seasonId: 'season-tx',
            userId: 'user-1',
          },
        },
      }),
    );
    expect(dormitoriesService.validateSelectableDormitoryForSeasonParticipant).toHaveBeenCalledWith(
      expect.objectContaining({
        seasonContext: objectContaining({
          season: objectContaining({ id: 'season-tx' }),
        }),
        queryClient: tx,
      }),
    );
  });

  it('withdrawn/declined 재등록은 거부한다', async () => {
    const { service, txSeasonParticipantUpsert, txSeasonParticipantUpdate } =
      createSeasonParticipantsServiceTestKit();
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

  it('tx 내부 user deletedAt 재조회에서 inactive account를 감지하면 finalize mutation을 수행하지 않는다', async () => {
    const {
      service,
      txUserFindUnique,
      txSeasonParticipantUpdate,
      txSeasonParticipantProfileHistoryCreate,
    } = createSeasonParticipantsServiceTestKit();
    txUserFindUnique.mockResolvedValueOnce({
      id: 'user-1',
      campus: 'CHUNCHEON',
      gender: 'M',
      emailVerifiedAt: now,
      deletedAt: now,
      displayIdentity: {
        userId: 'user-1',
        nickname: '현재닉네임',
        nicknameNormalized: '현재닉네임',
      },
    });

    await expect(service.finalizeSeasonRegistration('user-1', now)).rejects.toMatchObject({
      response: seasonParticipantsErrors.registrationNotAllowed().getResponse(),
    });
    expect(txSeasonParticipantUpdate).not.toHaveBeenCalled();
    expect(txSeasonParticipantProfileHistoryCreate).not.toHaveBeenCalled();
  });

  it('participant inactive/hidden 상태면 finalize mutation과 history 생성을 수행하지 않는다', async () => {
    for (const inactiveOverride of [{ deactivatedAt: now }, { hiddenByAdminAt: now }] as const) {
      const {
        service,
        txSeasonParticipantUpsert,
        txSeasonParticipantUpdate,
        txSeasonParticipantProfileHistoryCreate,
      } = createSeasonParticipantsServiceTestKit();
      txSeasonParticipantUpsert.mockResolvedValue(
        participant({
          ...inactiveOverride,
          dormitorySelectionState: 'SELECTED',
          dormitoryId: 'dasan',
          participantStatus: 'DRAFT',
          profile: profile(),
        }),
      );

      await expect(service.finalizeSeasonRegistration('user-1', now)).rejects.toMatchObject({
        response: seasonParticipantsErrors.registrationNotAllowed().getResponse(),
      });
      expect(txSeasonParticipantUpdate).not.toHaveBeenCalled();
      expect(txSeasonParticipantProfileHistoryCreate).not.toHaveBeenCalled();
    }
  });

  it('saved selection을 tx query client로 재검증하고 invalid이면 registration mutation을 수행하지 않는다', async () => {
    const {
      service,
      txSeasonParticipantUpsert,
      txSeasonParticipantUpdate,
      txSeasonParticipantProfileHistoryCreate,
      dormitoriesService,
    } = createSeasonParticipantsServiceTestKit();
    txSeasonParticipantUpsert.mockResolvedValue(
      participant({
        dormitorySelectionState: 'SELECTED',
        dormitoryId: 'dasan',
        participantStatus: 'DRAFT',
        profile: profile(),
      }),
    );
    dormitoriesService.validateSelectableDormitoryForSeasonParticipant.mockResolvedValueOnce({
      valid: false,
      reason: 'DORMITORY_NOT_OPERATED',
    });

    await expect(service.finalizeSeasonRegistration('user-1', now)).rejects.toMatchObject({
      response: seasonParticipantsErrors.dormitorySelectionInvalid().getResponse(),
    });
    expect(txSeasonParticipantUpdate).not.toHaveBeenCalled();
    expect(txSeasonParticipantProfileHistoryCreate).not.toHaveBeenCalled();
  });
});

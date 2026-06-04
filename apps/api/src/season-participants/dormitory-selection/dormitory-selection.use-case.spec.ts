import { seasonParticipantsErrors } from '../errors/season-participants.errors.js';
import {
  anyObject,
  createSeasonParticipantsServiceTestKit,
  now,
  objectContaining,
  participant,
  profile,
  seasonContext,
} from '../season-participants.owner.spec-fixtures.js';

describe('dormitory-selection use cases', () => {
  it('complete profile 상태에서도 현재 시즌의 본인 campus/gender 기준 selectable dormitory list를 반환한다', async () => {
    const { service, prisma, dormitoriesService } = createSeasonParticipantsServiceTestKit();
    prisma.seasonParticipant.findUnique.mockResolvedValue(participant({ profile: profile() }));

    const result = await service.listSelectableDormitoriesForCurrentSeason('user-1', now);

    expect(prisma.seasonParticipant.upsert).not.toHaveBeenCalled();
    expect(dormitoriesService.listSelectableDormitoriesForSeasonParticipant).toHaveBeenCalledWith(
      expect.objectContaining({
        seasonContext: objectContaining({ season: { id: 'season-1' } }),
        campusCodeSnapshot: 'CHUNCHEON',
        genderSnapshot: 'M',
        now,
      }),
    );
    expect(result.items).toEqual([
      expect.objectContaining({ id: 'dasan', name: '다산관', campusCode: 'CHUNCHEON' }),
    ]);
  });

  it('incomplete profile 상태여도 현재 시즌의 본인 campus/gender 기준 selectable dormitory list를 반환한다', async () => {
    const { service, prisma, dormitoriesService } = createSeasonParticipantsServiceTestKit();
    prisma.seasonParticipant.findUnique.mockResolvedValue(
      participant({ profile: profile({ drinkingTolerance: null }) }),
    );

    const result = await service.listSelectableDormitoriesForCurrentSeason('user-1', now);

    expect(prisma.seasonParticipant.upsert).not.toHaveBeenCalled();
    expect(dormitoriesService.listSelectableDormitoriesForSeasonParticipant).toHaveBeenCalledWith(
      expect.objectContaining({
        seasonContext: objectContaining({ season: { id: 'season-1' } }),
        campusCodeSnapshot: 'CHUNCHEON',
        genderSnapshot: 'M',
        now,
      }),
    );
    expect(result).toMatchObject({
      profileState: 'DRAFT',
      items: [expect.objectContaining({ id: 'dasan', campusCode: 'CHUNCHEON' })],
    });
    expect(result.completion.registrationUnavailableReasons).toContain('PROFILE_INCOMPLETE');
  });

  it('participant row가 없어도 selectable dormitory list는 사용자 snapshot 기준으로 read-only 조회한다', async () => {
    const { service, prisma, dormitoriesService } = createSeasonParticipantsServiceTestKit();
    prisma.seasonParticipant.findUnique.mockResolvedValueOnce(null);

    const result = await service.listSelectableDormitoriesForCurrentSeason('user-1', now);

    expect(prisma.seasonParticipant.upsert).not.toHaveBeenCalled();
    expect(dormitoriesService.listSelectableDormitoriesForSeasonParticipant).toHaveBeenCalledWith(
      expect.objectContaining({
        seasonContext: objectContaining({ season: { id: 'season-1' } }),
        campusCodeSnapshot: 'CHUNCHEON',
        genderSnapshot: 'M',
        now,
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

  it('createOrUpdateDormitorySelection()는 등록 전 선택만 저장하고 변경 가능하며 history를 만들지 않는다', async () => {
    const {
      service,
      tx,
      txSeasonParticipantUpsert,
      txSeasonParticipantUpdate,
      txSeasonParticipantProfileHistoryCreate,
      dormitoriesService,
    } = createSeasonParticipantsServiceTestKit();
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
    expect(dormitoriesService.validateSelectableDormitoryForSeasonParticipant).toHaveBeenCalledWith(
      expect.objectContaining({
        seasonContext: objectContaining({ season: { id: 'season-1' } }),
        campusCodeSnapshot: 'CHUNCHEON',
        genderSnapshot: 'M',
        dormitoryId: 'dasan',
        now,
        queryClient: tx,
      }),
    );
  });

  it('registration 후에는 dormitory selection 변경도 거부한다', async () => {
    const { service, txSeasonParticipantUpsert, txSeasonParticipantUpdate } =
      createSeasonParticipantsServiceTestKit();
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

  it('dormitory validation은 operated/campus/gender/cutoff/no selectable 조건을 닫는다', async () => {
    const {
      service,
      prisma,
      seasonsService,
      txSeasonParticipantUpsert,
      txSeasonParticipantUpdate,
      dormitoriesService,
    } = createSeasonParticipantsServiceTestKit();
    txSeasonParticipantUpsert.mockResolvedValue(participant({ profile: profile() }));

    for (const reason of [
      'DORMITORY_NOT_FOUND',
      'DORMITORY_CAMPUS_MISMATCH',
      'DORMITORY_GENDER_MISMATCH',
    ] as const) {
      dormitoriesService.validateSelectableDormitoryForSeasonParticipant.mockResolvedValueOnce({
        valid: false,
        reason,
      });
      await expect(
        service.createOrUpdateDormitorySelection('user-1', { dormitoryId: reason }, now),
      ).rejects.toMatchObject({
        response: seasonParticipantsErrors.dormitorySelectionInvalid().getResponse(),
      });
      expect(txSeasonParticipantUpdate).not.toHaveBeenCalled();
    }

    seasonsService.getCurrentSeasonContext.mockResolvedValue(
      seasonContext({ state: 'SEASON_MATCHING' }),
    );
    dormitoriesService.validateSelectableDormitoryForSeasonParticipant.mockResolvedValueOnce({
      valid: false,
      reason: 'DORMITORY_SELECTION_CLOSED',
    });
    await expect(
      service.createOrUpdateDormitorySelection('user-1', { dormitoryId: 'closed' }, now),
    ).rejects.toMatchObject({
      response: seasonParticipantsErrors.dormitorySelectionInvalid().getResponse(),
    });
    expect(txSeasonParticipantUpdate).not.toHaveBeenCalled();

    prisma.seasonParticipant.findUnique.mockResolvedValueOnce(participant({ profile: profile() }));
    dormitoriesService.listSelectableDormitoriesForSeasonParticipant.mockResolvedValueOnce([]);
    const noSelectable = await service.listSelectableDormitoriesForCurrentSeason('user-1', now);
    expect(noSelectable.completion.registrationUnavailableReasons).toContain(
      'NO_SELECTABLE_DORMITORY',
    );
  });

  it('profile incomplete 상태에서도 selectable dormitory 부재 사유를 함께 노출한다', async () => {
    const { service, prisma, dormitoriesService } = createSeasonParticipantsServiceTestKit();
    prisma.seasonParticipant.findUnique.mockResolvedValueOnce(
      participant({ profile: profile({ drinkingTolerance: null }) }),
    );
    dormitoriesService.listSelectableDormitoriesForSeasonParticipant.mockResolvedValueOnce([]);

    const response = await service.listSelectableDormitoriesForCurrentSeason('user-1', now);

    expect(response.completion.registrationUnavailableReasons).toEqual(
      expect.arrayContaining([
        'PROFILE_INCOMPLETE',
        'DORMITORY_SELECTION_REQUIRED',
        'NO_SELECTABLE_DORMITORY',
      ]),
    );
  });
});

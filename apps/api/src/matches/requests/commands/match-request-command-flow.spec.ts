import { matchesErrors } from '../../matches.errors.js';
import {
  createMatchesServiceSpecHarness,
  makeMatchRequestParticipant,
} from '../../test-support/matches-service-spec.harness.js';

describe('match request command flow', () => {
  const harness = createMatchesServiceSpecHarness();
  const {
    service,
    seasonsService,
    seasonParticipantsService,
    txMatchRequestFindFirst,
    txMatchRequestCount,
    txMatchRequestCreate,
    txMatchRequestFindUnique,
    txMatchRequestUpdate,
    txMatchRequestUpdateMany,
    txActiveMatchFindFirst,
    txActiveMatchCreate,
    txSeasonParticipantFindMany,
    txSeasonParticipantUpdateMany,
  } = harness;

  beforeEach(() => {
    harness.reset();
  });

  it('요청 생성은 SEASON_MATCHING + 등록 + 같은 건물 + roomSelectionDate 전 조건에서만 허용된다', async () => {
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      season: { id: 'season-1' },
      state: 'SEASON_OPEN',
      operatedDormitories: [
        { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-02-11' },
      ],
      schedule: {
        preparationStart: '2026-02-01',
        matchingStart: '2026-02-05',
        matchingEnd: '2026-02-11',
        seasonEnd: '2026-02-28',
      },
    });

    await expect(
      service.createMatchRequest(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        { targetUserId: 'user-2', note: '안녕하세요' },
      ),
    ).rejects.toMatchObject({
      response: matchesErrors.requestNotAllowed().getResponse(),
    });
  });
  it('target registration snapshot이 없으면 등록/배정 상태여도 매칭 요청 action을 닫는다', async () => {
    seasonParticipantsService.hasRegistrationSnapshotForParticipant.mockResolvedValueOnce(false);

    await expect(
      service.createMatchRequest(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        { targetUserId: 'user-2', note: '안녕하세요' },
      ),
    ).rejects.toMatchObject({
      response: matchesErrors.requestNotAllowed().getResponse(),
    });

    expect(txMatchRequestCreate).not.toHaveBeenCalled();
  });
  it('요청 생성 transaction 내부에서 target 상태를 재점검해 race로 숨김/삭제된 target 생성을 막는다', async () => {
    txSeasonParticipantFindMany.mockResolvedValueOnce([
      {
        id: 'participant-1',
        ...makeMatchRequestParticipant('user-1'),
      },
      {
        id: 'participant-2',
        ...makeMatchRequestParticipant('user-2', {
          hiddenByAdminAt: new Date('2026-02-10T03:00:00.000Z'),
        }),
      },
    ]);

    await expect(
      service.createMatchRequest(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        { targetUserId: 'user-2', note: '안녕하세요' },
      ),
    ).rejects.toMatchObject({
      response: matchesErrors.requestNotAllowed().getResponse(),
    });

    expect(txSeasonParticipantFindMany).toHaveBeenCalled();
    expect(txMatchRequestCreate).not.toHaveBeenCalled();
  });
  it('target participant는 action 준비 중 ensure/upsert하지 않고 기존 SeasonParticipant만 조회한다', async () => {
    seasonParticipantsService.findCurrentSeasonParticipant.mockResolvedValueOnce(null);

    await expect(
      service.createMatchRequest(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        { targetUserId: 'user-2', note: '안녕하세요' },
      ),
    ).rejects.toMatchObject({
      response: matchesErrors.requestTargetNotFound().getResponse(),
    });

    expect(seasonParticipantsService.ensureCurrentSeasonParticipant).toHaveBeenCalledTimes(1);
    expect(seasonParticipantsService.ensureCurrentSeasonParticipant).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      expect.any(Date),
    );
    expect(seasonParticipantsService.findCurrentSeasonParticipant).toHaveBeenCalledWith(
      'user-2',
      'season-1',
    );
    expect(txMatchRequestCreate).not.toHaveBeenCalled();
  });
  it('same-pair live pending duplicate를 차단한다', async () => {
    txMatchRequestFindFirst.mockResolvedValueOnce({ id: 'request-existing' });

    await expect(
      service.createMatchRequest(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        { targetUserId: 'user-2', note: '안녕하세요' },
      ),
    ).rejects.toMatchObject({
      response: matchesErrors.requestAlreadyPending().getResponse(),
    });
  });
  it('같은 방향 cooldown 2일을 적용한다', async () => {
    txMatchRequestCount.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    txMatchRequestFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ terminalAt: new Date('2026-02-09T12:00:00.000Z') });

    await expect(
      service.createMatchRequest(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        { targetUserId: 'user-2', note: null },
      ),
    ).rejects.toMatchObject({
      response: matchesErrors.requestDirectionCooldownActive().getResponse(),
    });
  });
  it('같은 방향 시즌당 5회 제한을 적용한다', async () => {
    txMatchRequestCount.mockResolvedValueOnce(0).mockResolvedValueOnce(5);

    await expect(
      service.createMatchRequest(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        { targetUserId: 'user-2', note: null },
      ),
    ).rejects.toMatchObject({
      response: matchesErrors.requestDirectionLimitReached().getResponse(),
    });
  });
  it('요청 생성 시 expiresAt은 roomSelectionDate와 5일 TTL 중 더 이른 시점을 쓴다', async () => {
    const result = await service.createMatchRequest(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      { targetUserId: 'user-2', note: '안녕하세요' },
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const [createCall] = txMatchRequestCreate.mock.calls;
    expect(createCall).toBeDefined();
    if (!createCall) {
      throw new Error('Expected create call');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(createCall[0]).toMatchObject({
      data: {
        pairKey: 'participant-1:participant-2',
        pairMinParticipantId: 'participant-1',
        pairMaxParticipantId: 'participant-2',
        status: 'PENDING',
      },
    });
    expect(result.request.status).toBe('PENDING');
    expect(result.activeMatch).toBeNull();
  });
  it('수락은 즉시 ACTIVE를 만들고 다른 pending을 system cancel한다', async () => {
    const result = await service.acceptMatchRequest(
      {
        id: 'user-2',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'request-1',
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const [acceptedUpdateCall] = txMatchRequestUpdate.mock.calls;
    expect(acceptedUpdateCall).toBeDefined();
    if (!acceptedUpdateCall) {
      throw new Error('Expected accepted update call');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(acceptedUpdateCall[0]).toMatchObject({
      where: { id: 'request-1' },
      data: {
        status: 'ACCEPTED',
        terminalReason: 'ACCEPTED',
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const [activeCreateCall] = txActiveMatchCreate.mock.calls;
    expect(activeCreateCall).toBeDefined();
    if (!activeCreateCall) {
      throw new Error('Expected active create call');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(activeCreateCall[0]).toMatchObject({
      data: {
        seasonId: 'season-1',
        pairKey: 'participant-1:participant-2',
        createdFromRequestId: 'request-1',
        status: 'ACTIVE',
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const [participantUpdateCall] = txSeasonParticipantUpdateMany.mock.calls;
    expect(participantUpdateCall).toBeDefined();
    if (!participantUpdateCall) {
      throw new Error('Expected participant updateMany call');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(participantUpdateCall[0]).toMatchObject({
      data: { participantStatus: 'MATCHED' },
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const systemCancelCall = txMatchRequestUpdateMany.mock.calls.at(-1);
    expect(systemCancelCall).toBeDefined();
    if (!systemCancelCall) {
      throw new Error('Expected system cancel updateMany call');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(systemCancelCall[0]).toMatchObject({
      data: {
        status: 'CANCELLED_BY_SYSTEM',
        terminalReason: 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH',
      },
    });
    expect(result.request.status).toBe('ACCEPTED');
    expect(result.activeMatch?.counterpartUserId).toBe('user-1');
  });
  it('거절은 terminal only이며 ACTIVE를 만들지 않는다', async () => {
    const result = await service.rejectMatchRequest(
      {
        id: 'user-2',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'request-1',
    );

    expect(txActiveMatchCreate).not.toHaveBeenCalled();
    expect(result.request.status).toBe('REJECTED');
    expect(result.activeMatch).toBeNull();
  });
  it('취소는 terminal only이며 ACTIVE를 만들지 않는다', async () => {
    const result = await service.cancelMatchRequest(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'request-1',
    );

    expect(txActiveMatchCreate).not.toHaveBeenCalled();
    expect(result.request.status).toBe('CANCELLED_BY_REQUESTER');
    expect(result.activeMatch).toBeNull();
  });
  it('만료된 요청 수락은 EXPIRED 처리하고 ACTIVE를 만들지 않는다', async () => {
    txMatchRequestFindUnique.mockResolvedValueOnce({
      id: 'request-1',
      seasonId: 'season-1',
      requesterParticipantId: 'participant-1',
      receiverParticipantId: 'participant-2',
      status: 'PENDING',
      note: null,
      createdAt: new Date('2026-02-05T03:00:00.000Z'),
      expiresAt: new Date('2026-02-10T02:59:00.000Z'),
      terminalAt: null,
      acceptedAt: null,
      terminalReason: null,
      requesterParticipant: makeMatchRequestParticipant('user-1'),
      receiverParticipant: makeMatchRequestParticipant('user-2'),
    });

    await expect(
      service.acceptMatchRequest(
        {
          id: 'user-2',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        'request-1',
      ),
    ).rejects.toMatchObject({
      response: matchesErrors.requestExpired().getResponse(),
    });
    expect(txActiveMatchCreate).not.toHaveBeenCalled();
  });
  it('single-active invariant가 있으면 수락을 막는다', async () => {
    txActiveMatchFindFirst.mockResolvedValueOnce({ id: 'active-existing' });

    await expect(
      service.acceptMatchRequest(
        {
          id: 'user-2',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        'request-1',
      ),
    ).rejects.toMatchObject({
      response: matchesErrors.activeMatchAlreadyExists().getResponse(),
    });
  });
  it('UNMATCHED 직후 같은 방향 재요청에도 2일 cooldown을 적용한다', async () => {
    txMatchRequestCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    txMatchRequestFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    txActiveMatchFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      endedAt: new Date('2026-02-09T12:00:00.000Z'),
    });

    await expect(
      service.createMatchRequest(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        { targetUserId: 'user-2', note: null },
      ),
    ).rejects.toMatchObject({
      response: matchesErrors.requestDirectionCooldownActive().getResponse(),
    });
  });
});

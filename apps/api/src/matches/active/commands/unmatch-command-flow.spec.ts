import { matchesErrors } from '../../matches.errors.js';
import {
  createMatchesServiceSpecHarness,
  makeParticipant,
  makeUserSeed,
  type UserSeed,
} from '../../test-support/matches-service-spec.harness.js';

describe('active unmatch command flow', () => {
  const harness = createMatchesServiceSpecHarness();
  const {
    service,
    seasonsService,
    prisma,
    seasonParticipantsService,
    chatMatchThreadLifecycle,
    txActiveMatchFindUnique,
    txActiveMatchUpdate,
    txActiveMatchUnmatchRequestFindMany,
    txActiveMatchUnmatchRequestUpdate,
    txActiveMatchUnmatchRequestUpdateMany,
    txSeasonParticipantUpdateMany,
  } = harness;

  beforeEach(() => {
    harness.reset();
  });

  it('한쪽만 매칭 취소 요청을 보내면 ACTIVE는 유지되고 pending unmatch request만 남는다', async () => {
    txActiveMatchUnmatchRequestFindMany.mockResolvedValueOnce([
      {
        id: 'unmatch-1',
        participantId: 'participant-1',
        status: 'PENDING',
        requestedAt: new Date('2026-02-10T03:00:00.000Z'),
        terminalAt: null,
      },
    ]);
    txActiveMatchFindUnique
      .mockResolvedValueOnce({
        id: 'active-1',
        seasonId: 'season-1',
        participantAId: 'participant-1',
        participantBId: 'participant-2',
        status: 'ACTIVE',
        startedAt: new Date('2026-02-10T03:00:00.000Z'),
        endedAt: null,
        endReason: null,
        createdFromRequestId: 'request-1',
        participantA: {
          userId: 'user-1',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        participantB: {
          userId: 'user-2',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        unmatchRequests: [],
      })
      .mockResolvedValueOnce({
        id: 'active-1',
        seasonId: 'season-1',
        participantAId: 'participant-1',
        participantBId: 'participant-2',
        status: 'ACTIVE',
        startedAt: new Date('2026-02-10T03:00:00.000Z'),
        endedAt: null,
        endReason: null,
        createdFromRequestId: 'request-1',
        participantA: {
          userId: 'user-1',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        participantB: {
          userId: 'user-2',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        unmatchRequests: [
          {
            id: 'unmatch-1',
            participantId: 'participant-1',
            status: 'PENDING',
            requestedAt: new Date('2026-02-10T03:00:00.000Z'),
            terminalAt: null,
          },
        ],
      });

    const result = await service.requestUnmatch(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'active-1',
    );

    expect(txActiveMatchUpdate).not.toHaveBeenCalled();
    expect(chatMatchThreadLifecycle.handleActiveMatchUnmatched).not.toHaveBeenCalled();
    expect(result.activeMatch.status).toBe('ACTIVE');
    expect(result.activeMatch.unmatchProgress).toMatchObject({
      state: 'WAITING_FOR_COUNTERPART',
      requestedByViewerAt: new Date('2026-02-10T03:00:00.000Z').toISOString(),
      requestedByCounterpartAt: null,
      progressCount: 1,
      requiredCount: 2,
      canRequest: false,
      canCancel: true,
    });
  });
  it('양쪽 모두 매칭 취소 요청을 보내면 즉시 UNMATCHED가 되고 participant/chat state도 함께 정리된다', async () => {
    txActiveMatchFindUnique
      .mockResolvedValueOnce({
        id: 'active-1',
        seasonId: 'season-1',
        participantAId: 'participant-1',
        participantBId: 'participant-2',
        status: 'ACTIVE',
        startedAt: new Date('2026-02-10T03:00:00.000Z'),
        endedAt: null,
        endReason: null,
        createdFromRequestId: 'request-1',
        participantA: {
          userId: 'user-1',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        participantB: {
          userId: 'user-2',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        unmatchRequests: [
          {
            id: 'unmatch-1',
            participantId: 'participant-1',
            status: 'PENDING',
            requestedAt: new Date('2026-02-10T03:00:00.000Z'),
            terminalAt: null,
          },
        ],
      })
      .mockResolvedValue({
        id: 'active-1',
        seasonId: 'season-1',
        participantAId: 'participant-1',
        participantBId: 'participant-2',
        status: 'UNMATCHED',
        startedAt: new Date('2026-02-10T03:00:00.000Z'),
        endedAt: new Date('2026-02-10T03:05:00.000Z'),
        endReason: 'UNMATCHED_BY_MUTUAL_CONSENT',
        createdFromRequestId: 'request-1',
        participantA: {
          userId: 'user-1',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        participantB: {
          userId: 'user-2',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        unmatchRequests: [
          {
            id: 'unmatch-1',
            participantId: 'participant-1',
            status: 'FULFILLED_BY_MUTUAL_CONSENT',
            requestedAt: new Date('2026-02-10T03:00:00.000Z'),
            terminalAt: new Date('2026-02-10T03:05:00.000Z'),
          },
          {
            id: 'unmatch-2',
            participantId: 'participant-2',
            status: 'FULFILLED_BY_MUTUAL_CONSENT',
            requestedAt: new Date('2026-02-10T03:05:00.000Z'),
            terminalAt: new Date('2026-02-10T03:05:00.000Z'),
          },
        ],
      });
    txActiveMatchUnmatchRequestFindMany.mockResolvedValueOnce([
      {
        id: 'unmatch-1',
        participantId: 'participant-1',
        status: 'PENDING',
        requestedAt: new Date('2026-02-10T03:00:00.000Z'),
        terminalAt: null,
      },
      {
        id: 'unmatch-2',
        participantId: 'participant-2',
        status: 'PENDING',
        requestedAt: new Date('2026-02-10T03:05:00.000Z'),
        terminalAt: null,
      },
    ]);

    const result = await service.requestUnmatch(
      {
        id: 'user-2',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'active-1',
    );

    expect(txActiveMatchUnmatchRequestUpdateMany).toHaveBeenCalledWith({
      where: {
        activeMatchId: 'active-1',
        status: 'PENDING',
      },
      data: {
        status: 'FULFILLED_BY_MUTUAL_CONSENT',
        terminalAt: new Date('2026-02-10T03:00:00.000Z'),
      },
    });
    expect(txSeasonParticipantUpdateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['participant-1', 'participant-2'] },
      },
      data: {
        participantStatus: 'ACTIVE',
        matchedAt: null,
      },
    });
    expect(chatMatchThreadLifecycle.handleActiveMatchUnmatched).toHaveBeenCalledWith(
      expect.anything(),
      { activeMatchId: 'active-1' },
      new Date('2026-02-10T03:00:00.000Z'),
    );
    expect(result.activeMatch).toMatchObject({
      status: 'UNMATCHED',
      endReason: 'UNMATCHED_BY_MUTUAL_CONSENT',
    });
  });
  it('본인이 보낸 매칭 취소 요청은 상대가 요청하기 전까지 철회할 수 있다', async () => {
    txActiveMatchUnmatchRequestFindMany.mockResolvedValueOnce([
      {
        id: 'unmatch-1',
        participantId: 'participant-1',
        status: 'PENDING',
        requestedAt: new Date('2026-02-10T03:00:00.000Z'),
        terminalAt: null,
      },
    ]);
    txActiveMatchFindUnique
      .mockResolvedValueOnce({
        id: 'active-1',
        seasonId: 'season-1',
        participantAId: 'participant-1',
        participantBId: 'participant-2',
        status: 'ACTIVE',
        startedAt: new Date('2026-02-10T03:00:00.000Z'),
        endedAt: null,
        endReason: null,
        createdFromRequestId: 'request-1',
        participantA: {
          userId: 'user-1',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        participantB: {
          userId: 'user-2',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        unmatchRequests: [
          {
            id: 'unmatch-1',
            participantId: 'participant-1',
            status: 'PENDING',
            requestedAt: new Date('2026-02-10T03:00:00.000Z'),
            terminalAt: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        id: 'active-1',
        seasonId: 'season-1',
        participantAId: 'participant-1',
        participantBId: 'participant-2',
        status: 'ACTIVE',
        startedAt: new Date('2026-02-10T03:00:00.000Z'),
        endedAt: null,
        endReason: null,
        createdFromRequestId: 'request-1',
        participantA: {
          userId: 'user-1',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        participantB: {
          userId: 'user-2',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        unmatchRequests: [
          {
            id: 'unmatch-1',
            participantId: 'participant-1',
            status: 'CANCELLED_BY_REQUESTER',
            requestedAt: new Date('2026-02-10T03:00:00.000Z'),
            terminalAt: new Date('2026-02-10T03:00:00.000Z'),
          },
        ],
      });

    const result = await service.cancelUnmatchRequest(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'active-1',
    );

    expect(txActiveMatchUnmatchRequestUpdate).toHaveBeenCalledWith({
      where: { id: 'unmatch-1' },
      data: {
        status: 'CANCELLED_BY_REQUESTER',
        terminalAt: new Date('2026-02-10T03:00:00.000Z'),
      },
    });
    expect(result.activeMatch).toMatchObject({
      status: 'ACTIVE',
      unmatchProgress: {
        state: 'NONE',
        requestedByViewerAt: null,
        requestedByCounterpartAt: null,
        progressCount: 0,
        requiredCount: 2,
        canRequest: true,
        canCancel: false,
      },
    });
  });
  it('pending unmatch request가 없으면 cancel route는 cancel-specific error를 유지한다', async () => {
    txActiveMatchUnmatchRequestFindMany.mockResolvedValueOnce([]);

    await expect(
      service.cancelUnmatchRequest(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        'active-1',
      ),
    ).rejects.toMatchObject({
      response: matchesErrors.unmatchRequestCancelNotAllowed().getResponse(),
    });

    expect(txActiveMatchUnmatchRequestUpdate).not.toHaveBeenCalled();
  });
  it('roomSelectionDate 이후 또는 SEASON_POST_MATCH에서는 매칭 취소 요청을 받을 수 없다', async () => {
    seasonsService.getCurrentSeasonContext.mockResolvedValueOnce({
      season: { id: 'season-1' },
      state: 'SEASON_POST_MATCH',
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
      service.requestUnmatch(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        'active-1',
      ),
    ).rejects.toMatchObject({
      response: matchesErrors
        .unmatchRequestNotAllowed(
          '매칭 취소는 같은 기숙사의 roomSelectionDate 전까지만 요청할 수 있습니다.',
        )
        .getResponse(),
    });
  });
  it('이미 종료된 active match에는 매칭 취소 요청을 적용하지 않는다', async () => {
    txActiveMatchFindUnique.mockResolvedValueOnce({
      id: 'active-1',
      seasonId: 'season-1',
      participantAId: 'participant-1',
      participantBId: 'participant-2',
      status: 'UNMATCHED',
      startedAt: new Date('2026-02-10T03:00:00.000Z'),
      endedAt: new Date('2026-02-10T03:05:00.000Z'),
      endReason: 'UNMATCHED_BY_MUTUAL_CONSENT',
      createdFromRequestId: 'request-1',
      participantA: {
        userId: 'user-1',
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      participantB: {
        userId: 'user-2',
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      unmatchRequests: [],
    });

    await expect(
      service.requestUnmatch(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        'active-1',
      ),
    ).rejects.toMatchObject({
      response: matchesErrors.unmatchRequestNotAllowed().getResponse(),
    });
  });
  it('active pair participant가 아닌 다른 auth user는 매칭 취소 요청을 보낼 수 없다', async () => {
    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(makeUserSeed({ id: where.id })),
    );
    seasonParticipantsService.ensureCurrentSeasonParticipant.mockImplementation((user: UserSeed) =>
      Promise.resolve(makeParticipant({ id: `participant-${user.id}`, userId: user.id })),
    );

    await expect(
      service.requestUnmatch(
        {
          id: 'user-3',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        'active-1',
      ),
    ).rejects.toMatchObject({
      response: matchesErrors.unmatchRequestNotAllowed().getResponse(),
    });
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '../../../generated/prisma/client.js';
import { matchesErrors } from '../../errors/matches.errors.js';
import {
  createMatchesServiceSpecHarness,
  makeParticipant,
  makeUserSeed,
  type UserSeed,
} from '../../test-support/matches-service-spec.harness.js';

const commandNow = new Date('2026-02-10T03:00:00.000Z');
const counterpartyRequestAt = new Date('2026-02-10T03:05:00.000Z');

function activeMatchRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'active-1',
    seasonId: 'season-1',
    participantAId: 'participant-1',
    participantBId: 'participant-2',
    status: 'ACTIVE',
    startedAt: commandNow,
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
    ...overrides,
  };
}

function unmatchRequestRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'unmatch-1',
    participantId: 'participant-1',
    status: 'PENDING',
    requestedAt: commandNow,
    terminalAt: null,
    ...overrides,
  };
}

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
    txActiveMatchUnmatchRequestCreate,
    txActiveMatchUnmatchRequestFindMany,
    txActiveMatchUnmatchRequestUpdate,
    txActiveMatchUnmatchRequestUpdateMany,
    txActiveMatchLifecycleEventCreate,
    txSeasonParticipantUpdateMany,
  } = harness;

  beforeEach(() => {
    harness.reset();
  });

  it('한쪽만 매칭 취소 요청을 보내면 ACTIVE는 유지되고 pending unmatch request와 event만 남는다', async () => {
    txActiveMatchUnmatchRequestFindMany.mockResolvedValueOnce([unmatchRequestRecord()]);
    txActiveMatchFindUnique.mockResolvedValueOnce(activeMatchRecord()).mockResolvedValueOnce(
      activeMatchRecord({
        unmatchRequests: [unmatchRequestRecord()],
      }),
    );

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
    expect(txActiveMatchLifecycleEventCreate).toHaveBeenCalledTimes(1);
    expect(txActiveMatchLifecycleEventCreate).toHaveBeenCalledWith({
      data: {
        activeMatchId: 'active-1',
        eventType: 'UNMATCH_REQUESTED',
        reason: 'USER_REQUESTED_UNMATCH',
        actorType: 'USER',
        actorUserId: 'user-1',
        sourceUnmatchRequestId: 'unmatch-1',
        occurredAt: commandNow,
        metadata: {
          transitionOwner: 'match.unmatch.request',
          previousStatus: 'ACTIVE',
          nextStatus: 'ACTIVE',
          unmatchRequestStatus: 'PENDING',
        },
      },
    });
    expect(result.activeMatch.status).toBe('ACTIVE');
    expect(result.activeMatch.unmatchProgress).toMatchObject({
      state: 'WAITING_FOR_COUNTERPART',
      requestedByViewerAt: commandNow.toISOString(),
      requestedByCounterpartAt: null,
      progressCount: 1,
      requiredCount: 2,
      canRequest: false,
      canCancel: true,
    });
  });

  it('viewer pending request가 이미 있으면 duplicate error를 유지하고 event를 남기지 않는다', async () => {
    txActiveMatchFindUnique.mockResolvedValueOnce(
      activeMatchRecord({
        unmatchRequests: [unmatchRequestRecord({ id: 'unmatch-existing' })],
      }),
    );

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
      response: matchesErrors.unmatchRequestAlreadySubmitted().getResponse(),
    });

    expect(txActiveMatchUnmatchRequestCreate).not.toHaveBeenCalled();
    expect(txActiveMatchLifecycleEventCreate).not.toHaveBeenCalled();
  });

  it('pending request unique race가 발생하면 duplicate error를 유지하고 event를 남기지 않는다', async () => {
    txActiveMatchUnmatchRequestCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

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
      response: matchesErrors.unmatchRequestAlreadySubmitted().getResponse(),
    });

    expect(txActiveMatchLifecycleEventCreate).not.toHaveBeenCalled();
  });

  it('양쪽 모두 매칭 취소 요청을 보내면 즉시 UNMATCHED가 되고 participant/chat state와 event도 함께 정리된다', async () => {
    txActiveMatchUnmatchRequestCreate.mockResolvedValueOnce({
      id: 'unmatch-2',
      activeMatchId: 'active-1',
      participantId: 'participant-2',
      status: 'PENDING',
      requestedAt: commandNow,
      terminalAt: null,
    });
    txActiveMatchFindUnique.mockResolvedValueOnce(
      activeMatchRecord({
        unmatchRequests: [unmatchRequestRecord()],
      }),
    );
    txActiveMatchUpdate.mockResolvedValueOnce(
      activeMatchRecord({
        status: 'UNMATCHED',
        endedAt: commandNow,
        endReason: 'UNMATCHED_BY_MUTUAL_CONSENT',
        unmatchRequests: [
          unmatchRequestRecord({
            status: 'FULFILLED_BY_MUTUAL_CONSENT',
            terminalAt: commandNow,
          }),
          unmatchRequestRecord({
            id: 'unmatch-2',
            participantId: 'participant-2',
            status: 'FULFILLED_BY_MUTUAL_CONSENT',
            requestedAt: counterpartyRequestAt,
            terminalAt: commandNow,
          }),
        ],
      }),
    );
    txActiveMatchUnmatchRequestFindMany.mockResolvedValueOnce([
      unmatchRequestRecord(),
      unmatchRequestRecord({
        id: 'unmatch-2',
        participantId: 'participant-2',
        requestedAt: counterpartyRequestAt,
      }),
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
        terminalAt: commandNow,
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
      commandNow,
    );
    expect(txActiveMatchLifecycleEventCreate).toHaveBeenCalledTimes(2);
    const lifecycleEventCreateCalls = txActiveMatchLifecycleEventCreate.mock.calls as Array<
      [unknown]
    >;
    const requestedEventCreateInput = lifecycleEventCreateCalls[0]?.[0];
    const unmatchedEventCreateInput = lifecycleEventCreateCalls[1]?.[0];
    expect(requestedEventCreateInput).toMatchObject({
      data: {
        activeMatchId: 'active-1',
        eventType: 'UNMATCH_REQUESTED',
        reason: 'USER_REQUESTED_UNMATCH',
        actorType: 'USER',
        actorUserId: 'user-2',
        sourceUnmatchRequestId: 'unmatch-2',
        metadata: {
          transitionOwner: 'match.unmatch.request',
          previousStatus: 'ACTIVE',
          nextStatus: 'ACTIVE',
          unmatchRequestStatus: 'PENDING',
        },
      },
    });
    expect(unmatchedEventCreateInput).toMatchObject({
      data: {
        activeMatchId: 'active-1',
        eventType: 'UNMATCHED',
        reason: 'MUTUAL_UNMATCH_CONSENT',
        actorType: 'USER',
        actorUserId: 'user-2',
        sourceUnmatchRequestId: 'unmatch-2',
        occurredAt: commandNow,
        metadata: {
          transitionOwner: 'match.unmatch.mutual',
          previousStatus: 'ACTIVE',
          nextStatus: 'UNMATCHED',
          previousEndReason: null,
          nextEndReason: 'UNMATCHED_BY_MUTUAL_CONSENT',
          unmatchRequestStatus: 'FULFILLED_BY_MUTUAL_CONSENT',
          chatMatchedThreadUpdated: { attempted: true },
          chatDirectThreadsReopened: { attempted: true, exactCountKnown: false },
        },
      },
    });
    expect(txActiveMatchLifecycleEventCreate.mock.invocationCallOrder[0]).toBeLessThan(
      txActiveMatchLifecycleEventCreate.mock.invocationCallOrder[1] ?? Number.POSITIVE_INFINITY,
    );
    expect(result.activeMatch).toMatchObject({
      status: 'UNMATCHED',
      endReason: 'UNMATCHED_BY_MUTUAL_CONSENT',
    });
  });

  it('본인이 보낸 매칭 취소 요청은 상대가 요청하기 전까지 철회할 수 있다', async () => {
    txActiveMatchUnmatchRequestFindMany.mockResolvedValueOnce([unmatchRequestRecord()]);
    txActiveMatchFindUnique
      .mockResolvedValueOnce(
        activeMatchRecord({
          unmatchRequests: [unmatchRequestRecord()],
        }),
      )
      .mockResolvedValueOnce(
        activeMatchRecord({
          unmatchRequests: [
            unmatchRequestRecord({
              status: 'CANCELLED_BY_REQUESTER',
              terminalAt: commandNow,
            }),
          ],
        }),
      );

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
        terminalAt: commandNow,
      },
      select: {
        id: true,
        participantId: true,
        status: true,
        requestedAt: true,
        terminalAt: true,
      },
    });
    expect(txActiveMatchLifecycleEventCreate).toHaveBeenCalledTimes(1);
    expect(txActiveMatchLifecycleEventCreate).toHaveBeenCalledWith({
      data: {
        activeMatchId: 'active-1',
        eventType: 'UNMATCH_REQUEST_CANCELLED',
        reason: 'USER_CANCELLED_UNMATCH_REQUEST',
        actorType: 'USER',
        actorUserId: 'user-1',
        sourceUnmatchRequestId: 'unmatch-1',
        occurredAt: commandNow,
        metadata: {
          transitionOwner: 'match.unmatch.cancel',
          previousStatus: 'ACTIVE',
          nextStatus: 'ACTIVE',
          unmatchRequestStatus: 'CANCELLED_BY_REQUESTER',
        },
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

  it('pending unmatch request가 없으면 cancel route는 cancel-specific error를 유지하고 event를 남기지 않는다', async () => {
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
    expect(txActiveMatchLifecycleEventCreate).not.toHaveBeenCalled();
  });

  it('roomSelectionDate 이후 또는 SEASON_POST_MATCH에서는 매칭 취소 요청을 받을 수 없고 event를 남기지 않는다', async () => {
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
    expect(txActiveMatchLifecycleEventCreate).not.toHaveBeenCalled();
  });

  it('이미 종료된 active match에는 매칭 취소 요청과 event를 적용하지 않는다', async () => {
    txActiveMatchFindUnique.mockResolvedValueOnce(
      activeMatchRecord({
        status: 'UNMATCHED',
        endedAt: counterpartyRequestAt,
        endReason: 'UNMATCHED_BY_MUTUAL_CONSENT',
      }),
    );

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
    expect(txActiveMatchLifecycleEventCreate).not.toHaveBeenCalled();
  });

  it('active pair participant가 아닌 다른 auth user는 매칭 취소 요청과 event를 보낼 수 없다', async () => {
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
    expect(txActiveMatchLifecycleEventCreate).not.toHaveBeenCalled();
  });
});

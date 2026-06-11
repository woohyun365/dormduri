import type { Prisma } from '../../../generated/prisma/client.js';
import {
  ActiveMatchLifecycleActorType,
  ActiveMatchLifecycleEventReason,
  ActiveMatchLifecycleEventType,
} from '../../../generated/prisma/enums.js';
import { ActiveMatchLifecycleEventRepository } from './active-match-lifecycle-event.repository.js';
import { ActiveMatchLifecycleEventWriter } from './active-match-lifecycle-event.writer.js';
import type { ActiveMatchLifecycleEventCreateInput } from './active-match-lifecycle-event.types.js';

describe('ActiveMatchLifecycleEventWriter', () => {
  const occurredAt = new Date('2026-02-10T03:00:00.000Z');
  const tx = {} as Prisma.TransactionClient;
  let create: jest.Mock<
    Promise<unknown>,
    [Prisma.TransactionClient, ActiveMatchLifecycleEventCreateInput]
  >;
  let writer: ActiveMatchLifecycleEventWriter;

  beforeEach(() => {
    create = jest.fn<
      Promise<unknown>,
      [Prisma.TransactionClient, ActiveMatchLifecycleEventCreateInput]
    >();
    create.mockResolvedValue({});
    writer = new ActiveMatchLifecycleEventWriter({
      create,
    } as unknown as ActiveMatchLifecycleEventRepository);
  });

  it('ACTIVE_CREATED taxonomy와 sanitized metadata를 repository input으로 넘긴다', async () => {
    await writer.recordActiveCreated(tx, {
      activeMatchId: 'active-1',
      actorUserId: 'user-1',
      sourceMatchRequestId: 'request-1',
      occurredAt,
      metadata: {
        transitionOwner: 'match.accept',
        previousStatus: 'NONE',
        nextStatus: 'ACTIVE',
        canceledPendingMatchRequests: 1,
        note: 'raw note must be stripped',
        token: 'secret-token',
      },
    });

    expect(create).toHaveBeenCalledWith(tx, {
      activeMatchId: 'active-1',
      eventType: ActiveMatchLifecycleEventType.ACTIVE_CREATED,
      reason: ActiveMatchLifecycleEventReason.MATCH_REQUEST_ACCEPTED,
      actorType: ActiveMatchLifecycleActorType.USER,
      actorUserId: 'user-1',
      sourceMatchRequestId: 'request-1',
      occurredAt,
      metadata: {
        transitionOwner: 'match.accept',
        previousStatus: 'NONE',
        nextStatus: 'ACTIVE',
        canceledPendingMatchRequests: 1,
      },
    });
  });

  it.each([
    {
      name: 'UNMATCH_REQUESTED',
      run: (eventWriter: ActiveMatchLifecycleEventWriter) =>
        eventWriter.recordUnmatchRequested(tx, {
          activeMatchId: 'active-1',
          actorUserId: 'user-1',
          sourceUnmatchRequestId: 'unmatch-request-1',
          occurredAt,
        }),
      expected: {
        eventType: ActiveMatchLifecycleEventType.UNMATCH_REQUESTED,
        reason: ActiveMatchLifecycleEventReason.USER_REQUESTED_UNMATCH,
        actorType: ActiveMatchLifecycleActorType.USER,
        actorUserId: 'user-1',
        sourceUnmatchRequestId: 'unmatch-request-1',
      },
    },
    {
      name: 'UNMATCH_REQUEST_CANCELLED',
      run: (eventWriter: ActiveMatchLifecycleEventWriter) =>
        eventWriter.recordUnmatchRequestCancelled(tx, {
          activeMatchId: 'active-1',
          actorUserId: 'user-1',
          sourceUnmatchRequestId: 'unmatch-request-1',
          occurredAt,
        }),
      expected: {
        eventType: ActiveMatchLifecycleEventType.UNMATCH_REQUEST_CANCELLED,
        reason: ActiveMatchLifecycleEventReason.USER_CANCELLED_UNMATCH_REQUEST,
        actorType: ActiveMatchLifecycleActorType.USER,
        actorUserId: 'user-1',
        sourceUnmatchRequestId: 'unmatch-request-1',
      },
    },
    {
      name: 'UNMATCH_REQUEST_EXPIRED',
      run: (eventWriter: ActiveMatchLifecycleEventWriter) =>
        eventWriter.recordUnmatchRequestExpired(tx, {
          activeMatchId: 'active-1',
          sourceUnmatchRequestId: 'unmatch-request-1',
          occurredAt,
        }),
      expected: {
        eventType: ActiveMatchLifecycleEventType.UNMATCH_REQUEST_EXPIRED,
        reason: ActiveMatchLifecycleEventReason.ROOM_SELECTION_CUTOFF,
        actorType: ActiveMatchLifecycleActorType.SYSTEM,
        sourceUnmatchRequestId: 'unmatch-request-1',
      },
    },
    {
      name: 'UNMATCHED',
      run: (eventWriter: ActiveMatchLifecycleEventWriter) =>
        eventWriter.recordUnmatched(tx, {
          activeMatchId: 'active-1',
          actorUserId: 'user-1',
          sourceUnmatchRequestId: 'unmatch-request-2',
          occurredAt,
        }),
      expected: {
        eventType: ActiveMatchLifecycleEventType.UNMATCHED,
        reason: ActiveMatchLifecycleEventReason.MUTUAL_UNMATCH_CONSENT,
        actorType: ActiveMatchLifecycleActorType.USER,
        actorUserId: 'user-1',
        sourceUnmatchRequestId: 'unmatch-request-2',
      },
    },
    {
      name: 'SEASON_ENDED',
      run: (eventWriter: ActiveMatchLifecycleEventWriter) =>
        eventWriter.recordSeasonEnded(tx, {
          activeMatchId: 'active-1',
          occurredAt,
        }),
      expected: {
        eventType: ActiveMatchLifecycleEventType.SEASON_ENDED,
        reason: ActiveMatchLifecycleEventReason.SEASON_ENDED_SWEEP,
        actorType: ActiveMatchLifecycleActorType.SYSTEM,
      },
    },
  ])('$name taxonomy를 Phase 9A 결정과 맞춘다', async ({ run, expected }) => {
    await run(writer);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        activeMatchId: 'active-1',
        occurredAt,
        ...expected,
      }),
    );
  });

  it('metadata가 allowlist 값을 갖지 않으면 undefined로 repository에 전달한다', async () => {
    await writer.recordSeasonEnded(tx, {
      activeMatchId: 'active-1',
      occurredAt,
      metadata: {
        token: 'secret-token',
        stack: 'stack trace',
      },
    });

    expect(create).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        eventType: ActiveMatchLifecycleEventType.SEASON_ENDED,
        metadata: undefined,
      }),
    );
  });
});

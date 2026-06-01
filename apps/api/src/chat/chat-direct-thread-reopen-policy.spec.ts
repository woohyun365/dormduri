import { resolveDirectThreadReopenStaticDecision } from './chat-direct-thread-reopen-policy.js';
import type { ThreadRecord } from './chat-selects.js';

const now = new Date('2026-02-10T03:00:00.000Z');

function makeThread(overrides: Partial<ThreadRecord> = {}): ThreadRecord {
  return {
    id: 'thread-1',
    seasonId: 'season-1',
    pairKey: 'participant-1:participant-2',
    participantAId: 'participant-1',
    participantBId: 'participant-2',
    openedByParticipantId: 'participant-1',
    threadKind: 'DIRECT',
    activeMatchId: null,
    status: 'READ_ONLY',
    closedReason: 'ACTIVE_MATCH_CREATED',
    closedAt: now,
    lastMessageAt: null,
    createdAt: now,
    updatedAt: now,
    season: {
      id: 'season-1',
      campusCode: 'CHUNCHEON',
      name: '2026-1',
      preparationStartDate: new Date('2026-02-01T00:00:00.000Z'),
      matchingStartDate: new Date('2026-02-05T00:00:00.000Z'),
      seasonEndDate: new Date('2026-02-28T00:00:00.000Z'),
      overrideState: null,
      overrideReason: null,
      overrideStartedAt: null,
      overrideEndsAt: null,
      dormitoryOperations: [],
    },
    participantA: {
      id: 'participant-1',
      userId: 'user-1',
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
    },
    participantB: {
      id: 'participant-2',
      userId: 'user-2',
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
    },
    activeMatch: null,
    members: [
      {
        participantId: 'participant-1',
        memberState: 'ACTIVE',
        leftAt: null,
        lastReadAt: null,
        lastReadMessageId: null,
        lastVisibleAt: null,
      },
      {
        participantId: 'participant-2',
        memberState: 'ACTIVE',
        leftAt: null,
        lastReadAt: null,
        lastReadMessageId: null,
        lastVisibleAt: null,
      },
    ],
    messages: [],
    ...overrides,
  } as ThreadRecord;
}

function decide(thread: ThreadRecord, roomSelectionDate = '2026-02-11') {
  return resolveDirectThreadReopenStaticDecision({
    thread,
    now,
    findThreadRoomSelectionDate: () => roomSelectionDate,
    formatKstDate: (date: Date) => date.toISOString().slice(0, 10),
  });
}

describe('resolveDirectThreadReopenStaticDecision', () => {
  it('ACTIVE_MATCH_CREATED direct READ_ONLY thread는 roomSelectionDate 전이면 reopen candidate다', () => {
    expect(decide(makeThread())).toEqual({ kind: 'REOPEN_CANDIDATE' });
  });

  it('roomSelectionDate가 지났거나 active member가 없으면 reopen하지 않는다', () => {
    expect(decide(makeThread(), '2026-02-09')).toEqual({
      kind: 'KEEP_READ_ONLY',
      reason: 'ROOM_SELECTION_CUTOFF',
    });
    expect(
      decide(
        makeThread({
          members: [
            {
              participantId: 'participant-1',
              memberState: 'LEFT',
              leftAt: now,
              lastReadAt: null,
              lastReadMessageId: null,
              lastVisibleAt: null,
            },
            {
              participantId: 'participant-2',
              memberState: 'LEFT',
              leftAt: now,
              lastReadAt: null,
              lastReadMessageId: null,
              lastVisibleAt: null,
            },
          ],
        }),
      ),
    ).toEqual({ kind: 'KEEP_READ_ONLY', reason: 'NO_ACTIVE_MEMBER' });
  });
});

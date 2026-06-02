import type { SeasonState } from '@repo/shared/season-contract';
import {
  resolveMatchedPairThreadSendMessageDecision,
  resolveThreadSendMessageDecision,
} from './chat-thread-permission.policy.js';
import type { ThreadRecord } from '../persistence/chat-thread.select.js';

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
    status: 'OPEN',
    closedReason: null,
    closedAt: null,
    lastMessageAt: now,
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

function resolveDirect(thread: ThreadRecord, roomSelectionDate: string | null) {
  return resolveThreadSendMessageDecision({
    thread,
    viewerParticipantId: 'participant-1',
    now,
    findThreadRoomSelectionDate: () => roomSelectionDate,
    resolveThreadSeasonState: () => 'SEASON_MATCHING',
  });
}

describe('chat-thread-permission policy', () => {
  it('keeps direct thread writable before room selection cutoff only', () => {
    expect(resolveDirect(makeThread(), '2026-02-10')).toEqual({
      canSendMessage: true,
      unavailableReason: null,
    });
    expect(resolveDirect(makeThread(), '2026-02-09')).toEqual({
      canSendMessage: false,
      unavailableReason: 'THREAD_READ_ONLY',
    });
  });

  it('returns precise unavailable reasons for left/read-only/archived states', () => {
    expect(
      resolveDirect(
        makeThread({
          members: [
            {
              participantId: 'participant-1',
              memberState: 'LEFT',
              leftAt: now,
              lastReadAt: null,
              lastReadMessageId: null,
              lastVisibleAt: now,
            },
          ] as ThreadRecord['members'],
        }),
        '2026-02-10',
      ),
    ).toMatchObject({ canSendMessage: false, unavailableReason: 'MEMBER_LEFT' });
    expect(
      resolveDirect(
        makeThread({ status: 'READ_ONLY', closedReason: 'SEASON_ENDED' }),
        '2026-02-10',
      ),
    ).toMatchObject({ canSendMessage: false, unavailableReason: 'SEASON_ENDED' });
    expect(resolveDirect(makeThread({ status: 'ARCHIVED' }), '2026-02-10')).toMatchObject({
      canSendMessage: false,
      unavailableReason: 'ARCHIVED_THREAD',
    });
  });

  it('keeps matched thread writable only during matching/post-match season states', () => {
    const matchedThread = makeThread({ threadKind: 'MATCHED', activeMatchId: 'active-1' });
    const decide = (state: SeasonState) =>
      resolveMatchedPairThreadSendMessageDecision({
        thread: matchedThread,
        viewerParticipantId: 'participant-1',
        now,
        resolveThreadSeasonState: () => state,
      });

    expect(decide('SEASON_POST_MATCH')).toEqual({ canSendMessage: true, unavailableReason: null });
    expect(decide('OFF_SEASON')).toEqual({
      canSendMessage: false,
      unavailableReason: 'SEASON_ENDED',
    });
  });
});

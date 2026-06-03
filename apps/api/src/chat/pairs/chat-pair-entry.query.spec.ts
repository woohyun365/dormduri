import type { AuthenticatedUserContext } from '../../auth/auth-session.service.js';
import type { ChatUserContext } from '../application/chat-user-context.service.js';
import type { ThreadRecord } from '../persistence/chat-thread.select.js';
import { createChatPairEntryQuery } from './chat-pair-entry.query.js';

function objectContaining(shape: Record<string, unknown>): unknown {
  return expect.objectContaining(shape) as unknown;
}

function makeAuthUser(): AuthenticatedUserContext {
  return {
    id: 'user-1',
    sessionId: 'session-1',
    actorType: 'USER',
    actorId: 'user-1',
    gender: 'M',
    campus: 'CHUNCHEON',
    capabilities: [],
  };
}

function makeViewerContext(): ChatUserContext {
  return {
    user: {
      id: 'user-1',
      emailVerifiedAt: new Date('2026-02-01T00:00:00.000Z'),
      gender: 'M',
      campus: 'CHUNCHEON',
    },
    seasonContext: {
      season: { id: 'season-1' },
      state: 'SEASON_MATCHING',
      operatedDormitories: [],
      schedule: null,
    } as unknown as ChatUserContext['seasonContext'],
    participant: { id: 'participant-1' } as ChatUserContext['participant'],
    selection: {
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
      source: 'SEASON_PARTICIPANT',
    },
  };
}

function makeThread(overrides: Partial<ThreadRecord> = {}): ThreadRecord {
  return {
    id: 'thread-1',
    status: 'OPEN',
    members: [{ participantId: 'participant-1', memberState: 'ACTIVE' }],
    ...overrides,
  } as ThreadRecord;
}

describe('createChatPairEntryQuery', () => {
  const now = new Date('2026-06-03T00:00:00.000Z');
  const deps = {
    getDatabaseNow: jest.fn(),
    getCurrentChatContext: jest.fn(),
    getValidatedTargetUser: jest.fn(),
    getRequiredParticipant: jest.fn(),
    findThreadByPair: jest.fn(),
    resolveThreadLifecycleSnapshot: jest.fn(),
    canSendMessageToPair: jest.fn(),
    getThreadMember: jest.fn(),
    toThreadSummary: jest.fn(),
  };
  const query = createChatPairEntryQuery(deps);

  beforeEach(() => {
    jest.clearAllMocks();
    deps.getDatabaseNow.mockResolvedValue(now);
    deps.getCurrentChatContext.mockResolvedValue(makeViewerContext());
    deps.getValidatedTargetUser.mockResolvedValue({
      id: 'user-2',
      emailVerifiedAt: new Date('2026-02-01T00:00:00.000Z'),
      gender: 'M',
      campus: 'CHUNCHEON',
    });
    deps.getRequiredParticipant.mockResolvedValue({ id: 'participant-2' });
    deps.findThreadByPair.mockResolvedValue(null);
    deps.resolveThreadLifecycleSnapshot.mockImplementation((thread: ThreadRecord) =>
      Promise.resolve(thread),
    );
    deps.canSendMessageToPair.mockResolvedValue({ canSendMessage: true, unavailableReason: null });
    deps.getThreadMember.mockImplementation(
      (thread: ThreadRecord, participantId: string) =>
        thread.members.find((member) => member.participantId === participantId) ?? null,
    );
    deps.toThreadSummary.mockReturnValue({ id: 'thread-1', canSendMessage: true });
  });

  it('viewer가 current chat context를 갖지 못하면 target 조회 없이 닫힌 entry를 반환한다', async () => {
    deps.getCurrentChatContext.mockResolvedValue(null);

    await expect(query.getThreadEntry(makeAuthUser(), 'user-2')).resolves.toEqual({
      targetUserId: 'user-2',
      thread: null,
      canEnterChatUi: false,
      canSendMessage: false,
    });

    expect(deps.getValidatedTargetUser).not.toHaveBeenCalled();
    expect(deps.findThreadByPair).not.toHaveBeenCalled();
  });

  it('target pair 조회와 send eligibility를 조합해 새 채팅 entry 가능 여부를 반환한다', async () => {
    await expect(query.getThreadEntry(makeAuthUser(), 'user-2')).resolves.toEqual({
      targetUserId: 'user-2',
      thread: null,
      canEnterChatUi: true,
      canSendMessage: true,
    });

    expect(deps.findThreadByPair).toHaveBeenCalledWith(
      'season-1',
      'participant-1',
      'participant-2',
    );
    expect(deps.canSendMessageToPair).toHaveBeenCalledWith(
      objectContaining({ participant: objectContaining({ id: 'participant-1' }) }),
      objectContaining({ id: 'user-2' }),
      objectContaining({ id: 'participant-2' }),
      null,
      now,
    );
  });

  it('visible active existing thread는 lifecycle snapshot 후 summary로 투영한다', async () => {
    const existingThread = makeThread();
    deps.findThreadByPair.mockResolvedValue(existingThread);
    deps.resolveThreadLifecycleSnapshot.mockResolvedValue(existingThread);

    await expect(query.getThreadEntry(makeAuthUser(), 'user-2')).resolves.toEqual({
      targetUserId: 'user-2',
      thread: { id: 'thread-1', canSendMessage: true },
      canEnterChatUi: true,
      canSendMessage: true,
    });

    expect(deps.resolveThreadLifecycleSnapshot).toHaveBeenCalledWith(existingThread, now);
    expect(deps.toThreadSummary).toHaveBeenCalledWith(
      existingThread,
      'participant-1',
      objectContaining({ canSendMessage: true }),
    );
  });

  it('archived 또는 inactive viewer thread는 thread를 숨기고 send decision만 entry 가능성에 반영한다', async () => {
    const archivedThread = makeThread({ status: 'ARCHIVED' });
    deps.findThreadByPair.mockResolvedValue(archivedThread);
    deps.resolveThreadLifecycleSnapshot.mockResolvedValue(archivedThread);
    deps.canSendMessageToPair.mockResolvedValue({
      canSendMessage: false,
      unavailableReason: 'ARCHIVED_THREAD',
    });

    await expect(query.getThreadEntry(makeAuthUser(), 'user-2')).resolves.toEqual({
      targetUserId: 'user-2',
      thread: null,
      canEnterChatUi: false,
      canSendMessage: false,
    });

    expect(deps.toThreadSummary).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chatErrors } from '../errors/chat.errors.js';
import type { CanonicalSelectionState } from '../../season-participants/application/season-participants.service.js';
import {
  createChatServiceSpecHarness,
  makeParticipant,
  makeThread as makeServiceThread,
  makeSendMessageInput,
  type ChatServiceSpecHarness,
  type UserSeed,
} from '../test-support/chat-service-spec.harness.js';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
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
    getDatabaseNow: vi.fn(),
    getCurrentChatContext: vi.fn(),
    getValidatedTargetUser: vi.fn(),
    getRequiredParticipant: vi.fn(),
    findThreadByPair: vi.fn(),
    resolveThreadLifecycleSnapshot: vi.fn(),
    canSendMessageToPair: vi.fn(),
    getThreadMember: vi.fn(),
    toThreadSummary: vi.fn(),
  };
  const query = createChatPairEntryQuery(deps);

  beforeEach(() => {
    vi.clearAllMocks();
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

describe('chat pair entry regression', () => {
  let expectMessageCreateClientMessageId: ChatServiceSpecHarness['expectMessageCreateClientMessageId'];
  let prisma: ChatServiceSpecHarness['prisma'];
  let prismaUserBlockFindFirst: ChatServiceSpecHarness['prismaUserBlockFindFirst'];
  let seasonParticipantsService: ChatServiceSpecHarness['seasonParticipantsService'];
  let seasonsService: ChatServiceSpecHarness['seasonsService'];
  let service: ChatServiceSpecHarness['service'];
  let txConversationMessageCreate: ChatServiceSpecHarness['txConversationMessageCreate'];
  let txConversationThreadCreate: ChatServiceSpecHarness['txConversationThreadCreate'];
  let txUserBlockFindFirst: ChatServiceSpecHarness['txUserBlockFindFirst'];

  beforeEach(() => {
    const harness = createChatServiceSpecHarness();
    ({
      expectMessageCreateClientMessageId,
      prisma,
      prismaUserBlockFindFirst,
      seasonParticipantsService,
      seasonsService,
      service,
      txConversationMessageCreate,
      txConversationThreadCreate,
      txUserBlockFindFirst,
    } = harness);
  });

  it('채팅 UI entry는 thread를 생성하지 않는다', async () => {
    const result = await service.getThreadEntry(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'user-2',
    );

    expect(result).toEqual({
      targetUserId: 'user-2',
      thread: null,
      canEnterChatUi: true,
      canSendMessage: true,
    });
    expect(prisma.conversationThread.findFirst).toHaveBeenCalled();
    expect(prisma.runSerializableTransaction).not.toHaveBeenCalled();
  });
  it('채팅 UI entry는 lifecycle snapshot만 계산하고 read path에서 thread를 update하지 않는다', async () => {
    prisma.conversationThread.findFirst.mockResolvedValue(
      makeServiceThread({
        messages: [
          {
            id: 'message-1',
            body: '입장 조회 메시지',
            sentAt: new Date('2026-02-10T03:00:00.000Z'),
            senderParticipant: { userId: 'user-1' },
          },
        ],
      }),
    );
    prisma.getDatabaseNow.mockResolvedValueOnce(new Date('2026-02-12T03:00:00.000Z'));

    const result = await service.getThreadEntry(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'user-2',
    );

    expect(result.thread).toMatchObject({
      id: 'thread-1',
      status: 'READ_ONLY',
      canSendMessage: false,
      sendMessageUnavailableReason: 'THREAD_READ_ONLY',
    });
    expect(result.canEnterChatUi).toBe(true);
    expect(result.canSendMessage).toBe(false);
    expect(prisma.conversationThread.update).not.toHaveBeenCalled();
  });
  it('시즌 참여자라도 UNASSIGNED면 같은 건물 사용자에 대한 채팅 UI entry와 send가 모두 닫힌다', async () => {
    seasonParticipantsService.ensureCurrentSeasonParticipant.mockImplementation((user: UserSeed) =>
      Promise.resolve(
        user.id === 'user-2'
          ? makeParticipant({ id: 'participant-2', userId: 'user-2' })
          : makeParticipant({
              id: 'participant-1',
              userId: user.id,
              dormitoryId: null,
              dormitorySelectionState: 'NOT_SELECTED',
              participantStatus: 'DRAFT',
            }),
      ),
    );
    seasonParticipantsService.selectCanonicalSelection.mockReturnValue({
      dormitoryId: null,
      dormitorySelectionState: 'UNASSIGNED',
      source: 'SEASON_PARTICIPANT',
    });

    const entry = await service.getThreadEntry(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'user-2',
    );
    expect(entry).toEqual({
      targetUserId: 'user-2',
      thread: null,
      canEnterChatUi: false,
      canSendMessage: false,
    });

    await expect(
      service.sendMessage(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        makeSendMessageInput('안녕하세요', 'client-message-policy-unassigned'),
      ),
    ).rejects.toMatchObject({
      response: chatErrors.messageSendNotAllowed().getResponse(),
    });
  });
  it('시즌 참여자라도 ASSIGNED 사용자는 다른 건물 사용자에게 채팅 UI entry와 send가 모두 닫힌다', async () => {
    seasonParticipantsService.findCurrentSeasonParticipant.mockResolvedValue(
      makeParticipant({
        id: 'participant-2',
        userId: 'user-2',
        dormitoryId: 'other-dorm',
        dormitorySelectionState: 'ASSIGNED',
      }),
    );

    const entry = await service.getThreadEntry(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'user-2',
    );

    expect(entry).toEqual({
      targetUserId: 'user-2',
      thread: null,
      canEnterChatUi: false,
      canSendMessage: false,
    });

    await expect(
      service.sendMessage(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        makeSendMessageInput(
          '다른 건물 사용자에게 보낼 수 없음',
          'client-message-policy-dormitory',
        ),
      ),
    ).rejects.toMatchObject({
      response: chatErrors.messageSendNotAllowed().getResponse(),
    });
  });
  it('시즌 참여 + ASSIGNED + 같은 건물 사용자면 채팅 UI entry와 send가 모두 열린다', async () => {
    const entry = await service.getThreadEntry(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'user-2',
    );

    expect(entry).toEqual({
      targetUserId: 'user-2',
      thread: null,
      canEnterChatUi: true,
      canSendMessage: true,
    });

    await expect(
      service.sendMessage(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        makeSendMessageInput('안녕하세요', 'client-message-entry-open'),
      ),
    ).resolves.toMatchObject({ createdThread: true });
    expectMessageCreateClientMessageId('client-message-entry-open');
  });
  it('live ActiveMatch가 없으면 stale MATCHED target도 채팅 후보로 유지한다', async () => {
    seasonParticipantsService.findCurrentSeasonParticipant.mockResolvedValue(
      makeParticipant({
        id: 'participant-2',
        userId: 'user-2',
        participantStatus: 'MATCHED',
        matchedAt: new Date('2026-02-01T00:00:00.000Z'),
      }),
    );

    const entry = await service.getThreadEntry(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'user-2',
    );

    expect(entry).toEqual({
      targetUserId: 'user-2',
      thread: null,
      canEnterChatUi: true,
      canSendMessage: true,
    });
  });
  it('SEASON_POST_MATCH에서 live ActiveMatch 사용자는 다른 일반 target과의 새 chat entry를 열 수 없다', async () => {
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
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
    prisma.activeMatch.findFirst
      .mockResolvedValueOnce({
        id: 'active-1',
        participantAId: 'participant-1',
        participantBId: 'participant-3',
        createdFromRequestId: 'request-1',
        startedAt: new Date('2026-02-10T03:00:00.000Z'),
        endedAt: null,
      })
      .mockResolvedValueOnce(null);

    const entry = await service.getThreadEntry(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'user-2',
    );

    expect(entry).toEqual({
      targetUserId: 'user-2',
      thread: null,
      canEnterChatUi: false,
      canSendMessage: false,
    });
  });
  it('상대가 시즌 참여자라도 ASSIGNED가 아니면 같은 캠퍼스/성별이어도 채팅 UI entry와 send가 모두 닫힌다', async () => {
    seasonParticipantsService.findCurrentSeasonParticipant.mockResolvedValue(
      makeParticipant({
        id: 'participant-2',
        userId: 'user-2',
        dormitoryId: null,
        dormitorySelectionState: 'UNASSIGNED',
        participantStatus: 'DRAFT',
      }),
    );
    seasonParticipantsService.selectCanonicalSelection.mockImplementation(
      (
        participant: Pick<
          CanonicalSelectionState,
          'dormitoryId' | 'dormitorySelectionState'
        > | null,
      ): CanonicalSelectionState => ({
        dormitoryId: participant?.dormitoryId ?? null,
        dormitorySelectionState: participant?.dormitorySelectionState ?? 'NOT_SELECTED',
        source: 'SEASON_PARTICIPANT',
      }),
    );

    const entry = await service.getThreadEntry(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'user-2',
    );

    expect(entry).toEqual({
      targetUserId: 'user-2',
      thread: null,
      canEnterChatUi: false,
      canSendMessage: false,
    });
  });
  it('target registration snapshot이 없으면 등록/배정 상태여도 새 채팅 entry와 send를 닫는다', async () => {
    seasonParticipantsService.hasRegistrationSnapshotForParticipant.mockResolvedValueOnce(false);

    const entry = await service.getThreadEntry(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'user-2',
    );

    expect(entry).toEqual({
      targetUserId: 'user-2',
      thread: null,
      canEnterChatUi: false,
      canSendMessage: false,
    });

    seasonParticipantsService.hasRegistrationSnapshotForParticipant.mockResolvedValueOnce(false);

    await expect(
      service.sendMessage(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        makeSendMessageInput('registration snapshot 없는 target', 'client-message-policy-snapshot'),
      ),
    ).rejects.toMatchObject({
      response: chatErrors.messageSendNotAllowed().getResponse(),
    });

    expect(txConversationThreadCreate).not.toHaveBeenCalled();
    expect(txConversationMessageCreate).not.toHaveBeenCalled();
  });
  it('target participant는 chat entry 준비 중 ensure/upsert하지 않고 기존 SeasonParticipant만 조회한다', async () => {
    seasonParticipantsService.findCurrentSeasonParticipant.mockResolvedValueOnce(null);

    await expect(
      service.getThreadEntry(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        'user-2',
      ),
    ).rejects.toMatchObject({
      response: chatErrors.threadTargetNotFound().getResponse(),
    });

    expect(seasonParticipantsService.ensureCurrentSeasonParticipant).toHaveBeenCalledTimes(1);
    expect(seasonParticipantsService.ensureCurrentSeasonParticipant).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      expect.any(Date),
    );
    expect(seasonParticipantsService.findCurrentSeasonParticipant).toHaveBeenCalledWith(
      'user-2',
      'season-1',
      undefined,
    );
    expect(prisma.conversationThread.findFirst).not.toHaveBeenCalled();
  });
  it('chat entry와 send는 active block이 양방향 중 하나라도 있으면 fail-closed 된다', async () => {
    prismaUserBlockFindFirst.mockResolvedValueOnce({ id: 'block-root' });

    await expect(
      service.getThreadEntry(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        'user-2',
      ),
    ).resolves.toEqual({
      targetUserId: 'user-2',
      thread: null,
      canEnterChatUi: false,
      canSendMessage: false,
    });

    txUserBlockFindFirst.mockResolvedValueOnce({ id: 'block-tx' });

    await expect(
      service.sendMessage(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        makeSendMessageInput('active block race 차단', 'client-message-policy-block-race'),
      ),
    ).rejects.toMatchObject({
      response: chatErrors.messageSendNotAllowed().getResponse(),
    });

    expect(txUserBlockFindFirst).toHaveBeenCalledWith({
      where: {
        unblockedAt: null,
        OR: [
          { blockerUserId: 'user-1', blockedUserId: 'user-2' },
          { blockerUserId: 'user-2', blockedUserId: 'user-1' },
        ],
      },
      select: { id: true },
    });
    expect(txConversationThreadCreate).not.toHaveBeenCalled();
    expect(txConversationMessageCreate).not.toHaveBeenCalled();
  });
});

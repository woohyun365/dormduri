import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MatchesService } from '../../../src/matches/application/matches.service.js';
import { ChatService } from '../../../src/chat/application/chat.service.js';
import { LifecycleSweepService } from '../../../src/lifecycle/lifecycle-sweep.service.js';
import { PrismaService } from '../../../src/platform/database/prisma.service.js';
import { createIntegrationApp } from '../_support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from '../_support/integration-db.js';
import {
  authContext,
  seedActiveMatchFixture,
  seedBaseSeasonFixtures,
  seedRegisteredAssignedParticipant,
} from '../_support/integration-fixtures.js';
import { expectLifecycleMetadataToExcludeSensitiveKeys } from '../_support/active-match-lifecycle-event-assertions.js';

describe('MatchesService unmatch integration', () => {
  let prisma: PrismaService;
  let service: MatchesService;
  let chatService: ChatService;
  let lifecycleSweepService: LifecycleSweepService;
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const sandbox = await createIntegrationDatabaseSandbox('unmatch_integration');
    cleanupDb = sandbox.cleanup;

    const { app, prisma: prismaService } = await createIntegrationApp();
    closeApp = () => app.close();
    prisma = prismaService;
    service = app.get(MatchesService);
    chatService = app.get(ChatService);
    lifecycleSweepService = app.get(LifecycleSweepService);
  });

  afterAll(async () => {
    if (closeApp) {
      await closeApp();
    }
    if (cleanupDb) {
      await cleanupDb();
    }
  });

  beforeEach(async () => {
    await truncateIntegrationSchema(prisma);
    await seedBaseSeasonFixtures(prisma);
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저가',
    });
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-b',
      participantId: 'participant-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '유저나',
    });
    await seedActiveMatchFixture(prisma, {
      activeMatchId: 'active-match-1',
      participantAId: 'participant-a',
      participantBId: 'participant-b',
      withMatchedThread: true,
    });
  });

  it('같은 participant가 동시에 두 번 unmatch 요청해도 pending request는 하나만 남는다', async () => {
    const settled = await Promise.allSettled([
      service.requestUnmatch(authContext('user-a'), 'active-match-1'),
      service.requestUnmatch(authContext('user-a'), 'active-match-1'),
    ]);

    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter((result) => result.status === 'rejected')).toHaveLength(1);

    const pendingRows = await prisma.activeMatchUnmatchRequest.findMany({
      where: {
        activeMatchId: 'active-match-1',
        participantId: 'participant-a',
        status: 'PENDING',
      },
    });
    expect(pendingRows).toHaveLength(1);

    const activeMatch = await prisma.activeMatch.findUnique({
      where: { id: 'active-match-1' },
    });
    expect(activeMatch?.status).toBe('ACTIVE');

    const lifecycleEvents = await prisma.activeMatchLifecycleEvent.findMany({
      where: { activeMatchId: 'active-match-1' },
      orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    });
    expect(lifecycleEvents).toHaveLength(1);
    expect(lifecycleEvents[0]).toMatchObject({
      eventType: 'UNMATCH_REQUESTED',
      reason: 'USER_REQUESTED_UNMATCH',
      actorType: 'USER',
      actorUserId: 'user-a',
    });
    expect(lifecycleEvents[0]?.sourceUnmatchRequestId).toBe(pendingRows[0]?.id);
    expect(lifecycleEvents[0]?.metadata).toEqual(
      expect.objectContaining({
        transitionOwner: 'match.unmatch.request',
        previousStatus: 'ACTIVE',
        nextStatus: 'ACTIVE',
        unmatchRequestStatus: 'PENDING',
      }),
    );
    expectLifecycleMetadataToExcludeSensitiveKeys(lifecycleEvents[0]?.metadata);
  });

  it('양쪽이 동시에 unmatch 요청하면 ACTIVE가 UNMATCHED로 전이되고 matched thread가 direct로 내려간다', async () => {
    const settled = await Promise.allSettled([
      service.requestUnmatch(authContext('user-a'), 'active-match-1'),
      service.requestUnmatch(authContext('user-b'), 'active-match-1'),
    ]);

    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(2);

    const activeMatch = await prisma.activeMatch.findUnique({
      where: { id: 'active-match-1' },
      include: {
        unmatchRequests: true,
      },
    });
    expect(activeMatch?.status).toBe('UNMATCHED');
    expect(activeMatch?.endReason).toBe('UNMATCHED_BY_MUTUAL_CONSENT');
    expect(activeMatch?.endedAt).not.toBeNull();
    expect(
      activeMatch?.unmatchRequests
        .map((row) => row.status)
        .every((status) => status === 'FULFILLED_BY_MUTUAL_CONSENT'),
    ).toBe(true);

    const thread = await prisma.conversationThread.findUnique({
      where: { id: 'active-match-1-thread' },
    });
    expect(thread?.threadKind).toBe('DIRECT');
    expect(thread?.activeMatchId).toBeNull();

    const lifecycleEvents = await prisma.activeMatchLifecycleEvent.findMany({
      where: { activeMatchId: 'active-match-1' },
      orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    });
    expect(lifecycleEvents.filter((event) => event.eventType === 'UNMATCH_REQUESTED')).toHaveLength(
      2,
    );
    expect(lifecycleEvents.filter((event) => event.eventType === 'UNMATCHED')).toHaveLength(1);
    expect(lifecycleEvents.at(-1)).toMatchObject({
      eventType: 'UNMATCHED',
      reason: 'MUTUAL_UNMATCH_CONSENT',
      actorType: 'USER',
    });
    expect(lifecycleEvents.at(-1)?.sourceUnmatchRequestId).toEqual(expect.any(String));
    expect(activeMatch?.unmatchRequests.map((request) => request.id)).toContain(
      lifecycleEvents.at(-1)?.sourceUnmatchRequestId,
    );
    expect(lifecycleEvents.at(-1)?.metadata).toEqual(
      expect.objectContaining({
        transitionOwner: 'match.unmatch.mutual',
        previousStatus: 'ACTIVE',
        nextStatus: 'UNMATCHED',
        nextEndReason: 'UNMATCHED_BY_MUTUAL_CONSENT',
        unmatchRequestStatus: 'FULFILLED_BY_MUTUAL_CONSENT',
      }),
    );
    for (const lifecycleEvent of lifecycleEvents) {
      expectLifecycleMetadataToExcludeSensitiveKeys(lifecycleEvent.metadata);
    }
  });

  it('pending unmatch cancel 성공은 cancel lifecycle event를 남긴다', async () => {
    await service.requestUnmatch(authContext('user-a'), 'active-match-1');
    await service.cancelUnmatchRequest(authContext('user-a'), 'active-match-1');

    const unmatchRequests = await prisma.activeMatchUnmatchRequest.findMany({
      where: {
        activeMatchId: 'active-match-1',
      },
      orderBy: [{ createdAt: 'asc' }],
    });
    expect(unmatchRequests).toHaveLength(1);
    expect(unmatchRequests[0]).toMatchObject({
      participantId: 'participant-a',
      status: 'CANCELLED_BY_REQUESTER',
    });

    const lifecycleEvents = await prisma.activeMatchLifecycleEvent.findMany({
      where: { activeMatchId: 'active-match-1' },
      orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    });
    expect(lifecycleEvents.map((event) => event.eventType)).toEqual([
      'UNMATCH_REQUESTED',
      'UNMATCH_REQUEST_CANCELLED',
    ]);
    expect(lifecycleEvents[1]).toMatchObject({
      reason: 'USER_CANCELLED_UNMATCH_REQUEST',
      actorType: 'USER',
      actorUserId: 'user-a',
      sourceUnmatchRequestId: unmatchRequests[0]?.id,
    });
    expect(lifecycleEvents[1]?.metadata).toEqual(
      expect.objectContaining({
        transitionOwner: 'match.unmatch.cancel',
        previousStatus: 'ACTIVE',
        nextStatus: 'ACTIVE',
        unmatchRequestStatus: 'CANCELLED_BY_REQUESTER',
      }),
    );
    for (const lifecycleEvent of lifecycleEvents) {
      expectLifecycleMetadataToExcludeSensitiveKeys(lifecycleEvent.metadata);
    }
  });

  it('season-ended boundary sweep는 pending unmatch expiry와 active match terminal event를 남기고 재실행 중복을 만들지 않는다', async () => {
    const databaseNow = await prisma.getDatabaseNow();
    await service.requestUnmatch(authContext('user-a'), 'active-match-1');
    await prisma.season.update({
      where: { id: 'season-integration' },
      data: {
        seasonEndDate: new Date(databaseNow.getTime() - 24 * 60 * 60 * 1_000),
      },
    });
    await prisma.seasonDormitoryOperation.update({
      where: {
        seasonId_dormitoryId: {
          seasonId: 'season-integration',
          dormitoryId: 'dasan',
        },
      },
      data: {
        roomSelectionDate: new Date(databaseNow.getTime() - 2 * 24 * 60 * 60 * 1_000),
      },
    });

    const firstSweep = await lifecycleSweepService.runBoundarySweep(databaseNow);
    expect(firstSweep.matchTransitions).toMatchObject({
      expiredUnmatchRequests: 1,
      seasonEndedActiveMatches: 1,
    });

    const activeMatch = await prisma.activeMatch.findUnique({
      where: { id: 'active-match-1' },
      include: {
        unmatchRequests: true,
      },
    });
    expect(activeMatch).toMatchObject({
      status: 'SEASON_ENDED',
      endReason: 'SEASON_ENDED',
    });
    expect(activeMatch?.unmatchRequests).toHaveLength(1);
    expect(activeMatch?.unmatchRequests[0]).toMatchObject({
      status: 'EXPIRED_BY_CUTOFF',
    });

    const lifecycleEvents = await prisma.activeMatchLifecycleEvent.findMany({
      where: { activeMatchId: 'active-match-1' },
      orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    });
    expect(lifecycleEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(['UNMATCH_REQUESTED', 'UNMATCH_REQUEST_EXPIRED', 'SEASON_ENDED']),
    );
    const sweepEvents = lifecycleEvents.filter((event) => event.eventType !== 'UNMATCH_REQUESTED');
    expect(sweepEvents.map((event) => event.eventType)).toEqual([
      'UNMATCH_REQUEST_EXPIRED',
      'SEASON_ENDED',
    ]);
    expect(sweepEvents[0]).toMatchObject({
      reason: 'ROOM_SELECTION_CUTOFF',
      actorType: 'SYSTEM',
      sourceUnmatchRequestId: activeMatch?.unmatchRequests[0]?.id,
    });
    expect(sweepEvents[0]?.metadata).toEqual(
      expect.objectContaining({
        transitionOwner: 'match.season-end.expire-unmatch-request',
        previousStatus: 'ACTIVE',
        nextStatus: 'ACTIVE',
        unmatchRequestStatus: 'EXPIRED_BY_CUTOFF',
        expiredUnmatchRequestCount: 1,
      }),
    );
    expect(sweepEvents[1]).toMatchObject({
      reason: 'SEASON_ENDED_SWEEP',
      actorType: 'SYSTEM',
      sourceUnmatchRequestId: null,
    });
    expect(sweepEvents[1]?.metadata).toEqual(
      expect.objectContaining({
        transitionOwner: 'match.season-end',
        previousStatus: 'ACTIVE',
        nextStatus: 'SEASON_ENDED',
        nextEndReason: 'SEASON_ENDED',
        expiredUnmatchRequestCount: 1,
      }),
    );
    for (const lifecycleEvent of lifecycleEvents) {
      expectLifecycleMetadataToExcludeSensitiveKeys(lifecycleEvent.metadata);
    }

    const secondSweep = await lifecycleSweepService.runBoundarySweep(databaseNow);
    expect(secondSweep.matchTransitions).toMatchObject({
      expiredUnmatchRequests: 0,
      seasonEndedActiveMatches: 0,
    });
    await expect(
      prisma.activeMatchLifecycleEvent.count({
        where: { activeMatchId: 'active-match-1' },
      }),
    ).resolves.toBe(3);
  });

  it('unmatch는 ACTIVE 생성 때 닫힌 eligible direct thread를 다시 OPEN하고 outbox를 남긴다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-c',
      participantId: 'participant-c',
      email: 'user-c@kangwon.ac.kr',
      nickname: '유저다',
    });
    await prisma.conversationThread.create({
      data: {
        id: 'thread-a-c-closed-by-active-match',
        seasonId: 'season-integration',
        pairKey: 'participant-a:participant-c',
        participantAId: 'participant-a',
        participantBId: 'participant-c',
        openedByParticipantId: 'participant-a',
        threadKind: 'DIRECT',
        activeMatchId: null,
        status: 'READ_ONLY',
        closedReason: 'ACTIVE_MATCH_CREATED',
        members: {
          create: [{ participantId: 'participant-a' }, { participantId: 'participant-c' }],
        },
      },
    });

    await service.requestUnmatch(authContext('user-a'), 'active-match-1');
    await service.requestUnmatch(authContext('user-b'), 'active-match-1');

    const matchedThread = await prisma.conversationThread.findUnique({
      where: { id: 'active-match-1-thread' },
    });
    expect(matchedThread?.threadKind).toBe('DIRECT');
    expect(matchedThread?.activeMatchId).toBeNull();

    const otherDirectThread = await prisma.conversationThread.findUnique({
      where: { id: 'thread-a-c-closed-by-active-match' },
    });
    expect(otherDirectThread).toMatchObject({
      threadKind: 'DIRECT',
      activeMatchId: null,
      status: 'OPEN',
      closedReason: null,
    });
    expect(otherDirectThread?.closedAt).toBeNull();

    const entry = await chatService.getThreadEntry(authContext('user-a'), 'user-c');
    expect(entry.canSendMessage).toBe(true);

    const reopenEvent = await prisma.chatRealtimeOutboxEvent.findFirst({
      where: {
        threadId: 'thread-a-c-closed-by-active-match',
        eventType: 'chat.thread.updated',
      },
      orderBy: { occurredAt: 'desc' },
    });
    expect(reopenEvent?.payload).toMatchObject({
      threadId: 'thread-a-c-closed-by-active-match',
      status: 'OPEN',
      closedReason: null,
    });
  });

  it('unmatch는 상대 direct participant가 여전히 active match 중이면 ACTIVE 생성 때 닫힌 direct thread를 reopen하지 않는다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-c',
      participantId: 'participant-c',
      email: 'user-c@kangwon.ac.kr',
      nickname: '유저다',
    });
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-d',
      participantId: 'participant-d',
      email: 'user-d@kangwon.ac.kr',
      nickname: '유저라',
    });
    await seedActiveMatchFixture(prisma, {
      activeMatchId: 'active-match-c-d',
      participantAId: 'participant-c',
      participantBId: 'participant-d',
    });
    await prisma.conversationThread.create({
      data: {
        id: 'thread-a-c-closed-by-c-active-match',
        seasonId: 'season-integration',
        pairKey: 'participant-a:participant-c',
        participantAId: 'participant-a',
        participantBId: 'participant-c',
        openedByParticipantId: 'participant-a',
        threadKind: 'DIRECT',
        activeMatchId: null,
        status: 'READ_ONLY',
        closedReason: 'ACTIVE_MATCH_CREATED',
        members: {
          create: [{ participantId: 'participant-a' }, { participantId: 'participant-c' }],
        },
      },
    });

    await service.requestUnmatch(authContext('user-a'), 'active-match-1');
    await service.requestUnmatch(authContext('user-b'), 'active-match-1');

    const otherDirectThread = await prisma.conversationThread.findUnique({
      where: { id: 'thread-a-c-closed-by-c-active-match' },
    });
    expect(otherDirectThread).toMatchObject({
      threadKind: 'DIRECT',
      activeMatchId: null,
      status: 'READ_ONLY',
      closedReason: 'ACTIVE_MATCH_CREATED',
    });
  });

  it('한쪽 cancel과 상대 request가 엇갈리면 ACTIVE 유지 또는 UNMATCHED 중 하나로만 수렴한다', async () => {
    const now = await prisma.getDatabaseNow();
    await prisma.activeMatchUnmatchRequest.create({
      data: {
        activeMatchId: 'active-match-1',
        participantId: 'participant-a',
        status: 'PENDING',
        requestedAt: new Date(now.getTime() - 60_000),
      },
    });

    const settled = await Promise.allSettled([
      service.cancelUnmatchRequest(authContext('user-a'), 'active-match-1'),
      service.requestUnmatch(authContext('user-b'), 'active-match-1'),
    ]);

    expect(settled.filter((result) => result.status === 'fulfilled').length).toBeGreaterThan(0);
    expect(settled.filter((result) => result.status === 'rejected').length).toBeLessThanOrEqual(1);

    const activeMatch = await prisma.activeMatch.findUnique({
      where: { id: 'active-match-1' },
      include: {
        unmatchRequests: {
          orderBy: [{ createdAt: 'asc' }],
        },
      },
    });
    const thread = await prisma.conversationThread.findUnique({
      where: { id: 'active-match-1-thread' },
    });

    expect(activeMatch).not.toBeNull();
    if (!activeMatch) {
      throw new Error('active match missing after cancel/request race');
    }

    if (activeMatch.status === 'ACTIVE') {
      expect(
        activeMatch.unmatchRequests.filter((request) => request.status === 'PENDING'),
      ).toHaveLength(1);
      expect(
        activeMatch.unmatchRequests.some(
          (request) =>
            request.participantId === 'participant-a' &&
            request.status === 'CANCELLED_BY_REQUESTER',
        ),
      ).toBe(true);
      expect(
        activeMatch.unmatchRequests.some(
          (request) => request.participantId === 'participant-b' && request.status === 'PENDING',
        ),
      ).toBe(true);
      expect(thread?.threadKind).toBe('MATCHED');
      expect(thread?.activeMatchId).toBe('active-match-1');
      return;
    }

    expect(activeMatch.status).toBe('UNMATCHED');
    expect(
      activeMatch.unmatchRequests.every(
        (request) => request.status === 'FULFILLED_BY_MUTUAL_CONSENT',
      ),
    ).toBe(true);
    expect(thread?.threadKind).toBe('DIRECT');
    expect(thread?.activeMatchId).toBeNull();
  });

  it('mutual unmatch와 chat send가 겹쳐도 최종 관계는 UNMATCHED이고 thread는 direct로 수렴한다', async () => {
    const settled = await Promise.allSettled([
      service.requestUnmatch(authContext('user-a'), 'active-match-1'),
      service.requestUnmatch(authContext('user-b'), 'active-match-1'),
      chatService.sendMessage(authContext('user-a'), {
        targetUserId: 'user-b',
        body: '매칭 해제 직전 메시지',
        clientMessageId: 'client-message-unmatch-race',
      }),
    ]);

    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(3);

    const activeMatch = await prisma.activeMatch.findUnique({
      where: { id: 'active-match-1' },
    });
    expect(activeMatch?.status).toBe('UNMATCHED');

    const thread = await prisma.conversationThread.findUnique({
      where: { id: 'active-match-1-thread' },
    });
    expect(thread?.threadKind).toBe('DIRECT');
    expect(thread?.activeMatchId).toBeNull();
    expect(thread?.lastMessageAt).not.toBeNull();

    const messages = await prisma.conversationMessage.findMany({
      where: { threadId: 'active-match-1-thread' },
      orderBy: [{ sentAt: 'asc' }, { createdAt: 'asc' }],
    });
    expect(messages.at(-1)?.body).toBe('매칭 해제 직전 메시지');
  });

  it('seasonEnd 이후 history는 unmatched-after-success를 current aggregate와 분리해 보존한다', async () => {
    const databaseNow = await prisma.getDatabaseNow();

    await chatService.sendMessage(authContext('user-a'), {
      targetUserId: 'user-b',
      body: '매칭된 상태에서 남긴 메시지',
      clientMessageId: 'client-message-unmatch-history',
    });

    await service.requestUnmatch(authContext('user-a'), 'active-match-1');
    await service.requestUnmatch(authContext('user-b'), 'active-match-1');

    await prisma.season.update({
      where: { id: 'season-integration' },
      data: {
        seasonEndDate: new Date(databaseNow.getTime() - 24 * 60 * 60 * 1_000),
      },
    });
    await prisma.seasonDormitoryOperation.update({
      where: {
        seasonId_dormitoryId: {
          seasonId: 'season-integration',
          dormitoryId: 'dasan',
        },
      },
      data: {
        roomSelectionDate: new Date(databaseNow.getTime() - 2 * 24 * 60 * 60 * 1_000),
      },
    });

    const sweepResult = await lifecycleSweepService.runBoundarySweep(databaseNow);
    expect(sweepResult.matchHistory.rebuiltEntries).toBeGreaterThanOrEqual(2);

    const history = await service.getMatchHistory(authContext('user-a'));
    expect(history.items).toHaveLength(1);
    expect(history.items[0]).toMatchObject({
      seasonId: 'season-integration',
      finalResult: 'UNMATCHED_AFTER_SUCCESS',
      sentRequestCount: 1,
      receivedRequestCount: 0,
    });
    expect(history.items[0]?.history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          counterpartParticipantId: 'participant-b',
          stage: 'MATCH',
          result: 'UNMATCHED_AFTER_SUCCESS',
          activeMatchEndReason: 'UNMATCHED_BY_MUTUAL_CONSENT',
        }),
      ]),
    );
    expect(history.items[0]?.history[0]).not.toHaveProperty('unmatchProgress');

    const thread = await prisma.conversationThread.findUnique({
      where: { id: 'active-match-1-thread' },
    });
    expect(thread?.threadKind).toBe('DIRECT');
  });
});

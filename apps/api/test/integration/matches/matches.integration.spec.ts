import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MatchesService } from '../../../src/matches/application/matches.service.js';
import { matchesErrors } from '../../../src/matches/errors/matches.errors.js';
import { PrismaService } from '../../../src/platform/database/prisma.service.js';
import { createIntegrationApp } from '../_support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from '../_support/integration-db.js';
import {
  toCompleteLifestyleColumnData,
  DEFAULT_LIFESTYLE,
} from '../_support/fixtures/lifestyle-profile.fixture.js';
import { authContext } from '../_support/fixtures/auth-context.fixture.js';
import { seedActiveMatchFixture } from '../_support/fixtures/matches.fixture.js';
import { seedBaseSeasonFixtures } from '../_support/fixtures/reference-data.fixture.js';
import { seedRegisteredAssignedParticipant } from '../_support/fixtures/participants.fixture.js';
import { expectLifecycleMetadataToExcludeSensitiveKeys } from '../_support/active-match-lifecycle-event-assertions.js';

describe('MatchesService integration', () => {
  let prisma: PrismaService;
  let service: MatchesService;
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const sandbox = await createIntegrationDatabaseSandbox('matches_integration');
    cleanupDb = sandbox.cleanup;

    const { app, prisma: prismaService } = await createIntegrationApp();
    closeApp = () => app.close();
    prisma = prismaService;
    service = app.get(MatchesService);
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
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-c',
      participantId: 'participant-c',
      email: 'user-c@kangwon.ac.kr',
      nickname: '유저다',
    });
  });

  it('같은 pair로 동시에 request를 생성해도 pending request는 하나만 남는다', async () => {
    const first = service.createMatchRequest(authContext('user-a'), {
      targetUserId: 'user-b',
      note: '같은 pair race 1',
    });
    const second = service.createMatchRequest(authContext('user-a'), {
      targetUserId: 'user-b',
      note: '같은 pair race 2',
    });

    const settled = await Promise.allSettled([first, second]);
    const fulfilledCount = settled.filter((result) => result.status === 'fulfilled').length;
    const rejected = settled.find((result) => result.status === 'rejected');

    expect(fulfilledCount).toBe(1);
    expect(rejected).toBeDefined();
    if (rejected?.status === 'rejected') {
      expect(rejected.reason).toMatchObject({
        response: {
          code: 'MATCH_REQUEST_ALREADY_PENDING',
        },
      });
    }

    const pendingRows = await prisma.matchRequest.findMany({
      where: {
        seasonId: 'season-integration',
        requesterParticipantId: 'participant-a',
        receiverParticipantId: 'participant-b',
        status: 'PENDING',
      },
    });

    expect(pendingRows).toHaveLength(1);
  });

  it('같은 receiver에 대한 경쟁 accept에서도 ACTIVE는 하나만 생성된다', async () => {
    const requestA = await service.createMatchRequest(authContext('user-a'), {
      targetUserId: 'user-b',
      note: 'request-a',
    });
    const requestB = await service.createMatchRequest(authContext('user-c'), {
      targetUserId: 'user-b',
      note: 'request-b',
    });

    const settled = await Promise.allSettled([
      service.acceptMatchRequest(authContext('user-b'), requestA.request.id),
      service.acceptMatchRequest(authContext('user-b'), requestB.request.id),
    ]);

    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = settled.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({
      response: matchesErrors.requestNotPending().getResponse(),
    });

    const liveActiveMatches = await prisma.activeMatch.findMany({
      where: {
        seasonId: 'season-integration',
        endedAt: null,
        OR: [{ participantAId: 'participant-b' }, { participantBId: 'participant-b' }],
      },
    });
    expect(liveActiveMatches).toHaveLength(1);

    const acceptedCount = await prisma.matchRequest.count({
      where: {
        id: { in: [requestA.request.id, requestB.request.id] },
        status: 'ACCEPTED',
      },
    });
    expect(acceptedCount).toBe(1);

    const [activeMatch] = liveActiveMatches;
    if (!activeMatch) {
      throw new Error('Expected a live active match');
    }
    const activeCreatedEvents = await prisma.activeMatchLifecycleEvent.findMany({
      where: {
        activeMatchId: activeMatch.id,
        eventType: 'ACTIVE_CREATED',
      },
    });
    expect(activeCreatedEvents).toHaveLength(1);
    expect(activeCreatedEvents[0]).toMatchObject({
      reason: 'MATCH_REQUEST_ACCEPTED',
      actorType: 'USER',
      actorUserId: 'user-b',
    });
    expect([requestA.request.id, requestB.request.id]).toContain(
      activeCreatedEvents[0]?.sourceMatchRequestId,
    );
    expect(activeCreatedEvents[0]?.metadata).toEqual(
      expect.objectContaining({
        transitionOwner: 'match.accept',
        previousStatus: 'NONE',
        nextStatus: 'ACTIVE',
        requestStatus: 'ACCEPTED',
      }),
    );
    expectLifecycleMetadataToExcludeSensitiveKeys(activeCreatedEvents[0]?.metadata);
    await expect(
      prisma.activeMatchLifecycleEvent.count({
        where: { activeMatchId: activeMatch.id },
      }),
    ).resolves.toBe(1);
  });

  it('같은 participant가 걸린 엇갈린 accept도 교착 없이 ACTIVE 하나와 409로 끝난다', async () => {
    const requestAToB = await service.createMatchRequest(authContext('user-a'), {
      targetUserId: 'user-b',
      note: 'a-to-b',
    });
    const requestCToA = await service.createMatchRequest(authContext('user-c'), {
      targetUserId: 'user-a',
      note: 'c-to-a',
    });

    const settled = await Promise.allSettled([
      service.acceptMatchRequest(authContext('user-b'), requestAToB.request.id),
      service.acceptMatchRequest(authContext('user-a'), requestCToA.request.id),
    ]);

    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = settled.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({
      response: matchesErrors.requestNotPending().getResponse(),
    });

    const liveActiveMatches = await prisma.activeMatch.findMany({
      where: { seasonId: 'season-integration', endedAt: null },
    });
    expect(liveActiveMatches).toHaveLength(1);

    const requests = await prisma.matchRequest.findMany({
      where: { id: { in: [requestAToB.request.id, requestCToA.request.id] } },
      select: { status: true, terminalReason: true, systemCancellationActiveMatchId: true },
    });
    expect(requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'ACCEPTED', terminalReason: 'ACCEPTED' }),
        expect.objectContaining({
          status: 'CANCELLED_BY_SYSTEM',
          terminalReason: 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH',
          systemCancellationActiveMatchId: liveActiveMatches[0]?.id,
        }),
      ]),
    );
    await expect(
      prisma.seasonParticipant.findUniqueOrThrow({
        where: { id: 'participant-a' },
        select: { participantStatus: true },
      }),
    ).resolves.toEqual({ participantStatus: 'MATCHED' });
  });

  it('같은 requester의 두 request를 서로 다른 receiver가 동시에 accept해도 ACTIVE는 하나다', async () => {
    const requestAToB = await service.createMatchRequest(authContext('user-a'), {
      targetUserId: 'user-b',
      note: 'a-to-b',
    });
    const requestAToC = await service.createMatchRequest(authContext('user-a'), {
      targetUserId: 'user-c',
      note: 'a-to-c',
    });

    const settled = await Promise.allSettled([
      service.acceptMatchRequest(authContext('user-b'), requestAToB.request.id),
      service.acceptMatchRequest(authContext('user-c'), requestAToC.request.id),
    ]);

    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = settled.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({
      response: matchesErrors.requestNotPending().getResponse(),
    });

    const liveActiveMatches = await prisma.activeMatch.findMany({
      where: { seasonId: 'season-integration', endedAt: null },
    });
    expect(liveActiveMatches).toHaveLength(1);

    const requests = await prisma.matchRequest.findMany({
      where: { id: { in: [requestAToB.request.id, requestAToC.request.id] } },
      select: { status: true, terminalReason: true, systemCancellationActiveMatchId: true },
    });
    expect(requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'ACCEPTED', terminalReason: 'ACCEPTED' }),
        expect.objectContaining({
          status: 'CANCELLED_BY_SYSTEM',
          terminalReason: 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH',
          systemCancellationActiveMatchId: liveActiveMatches[0]?.id,
        }),
      ]),
    );
  });

  it('기한이 지난 pending request를 accept하면 만료 사유로 409를 반환하고 ACTIVE를 만들지 않는다', async () => {
    const request = await service.createMatchRequest(authContext('user-a'), {
      targetUserId: 'user-b',
      note: 'expired',
    });
    await prisma.matchRequest.update({
      where: { id: request.request.id },
      data: { expiresAt: new Date('2000-01-01T00:00:00.000Z') },
    });

    await expect(
      service.acceptMatchRequest(authContext('user-b'), request.request.id),
    ).rejects.toMatchObject({
      response: matchesErrors.requestExpired().getResponse(),
    });
    await expect(
      prisma.activeMatch.count({ where: { seasonId: 'season-integration' } }),
    ).resolves.toBe(0);
    await expect(
      prisma.matchRequest.findUniqueOrThrow({
        where: { id: request.request.id },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: 'PENDING' });
  });

  it('pending 생성 후 requester profile snapshot invariant가 깨지면 accept가 system cancel로 fail-closed 된다', async () => {
    const request = await service.createMatchRequest(authContext('user-a'), {
      targetUserId: 'user-b',
      note: 'profile snapshot stale',
    });

    await prisma.seasonParticipantProfileHistory.deleteMany({
      where: { participantId: 'participant-a', source: 'SEASON_REGISTRATION' },
    });

    const result = await service.acceptMatchRequest(authContext('user-b'), request.request.id);
    expect(result).toMatchObject({
      activeMatch: null,
      request: {
        id: request.request.id,
        status: 'CANCELLED_BY_SYSTEM',
        terminalReason: 'MATCH_PRECONDITION_FAILED',
      },
    });

    await expect(
      prisma.activeMatch.findFirst({
        where: {
          seasonId: 'season-integration',
          endedAt: null,
          OR: [{ participantAId: 'participant-a' }, { participantBId: 'participant-a' }],
        },
      }),
    ).resolves.toBeNull();
    await expect(
      prisma.activeMatchLifecycleEvent.count({
        where: { sourceMatchRequestId: request.request.id },
      }),
    ).resolves.toBe(0);
  });

  it('withdrawn requester가 포함된 stale pending request는 accept race에서 active match를 만들지 않고 system cancel한다', async () => {
    const request = await service.createMatchRequest(authContext('user-a'), {
      targetUserId: 'user-b',
      note: 'withdrawn race',
    });
    const withdrawnAt = new Date('2026-02-10T04:00:00.000Z');

    await prisma.seasonParticipant.update({
      where: { id: 'participant-a' },
      data: {
        participationIntent: 'DECLINED',
        declinedAt: withdrawnAt,
        participantStatus: 'WITHDRAWN',
        withdrawnAt,
      },
    });

    const result = await service.acceptMatchRequest(authContext('user-b'), request.request.id);
    expect(result).toMatchObject({
      activeMatch: null,
      request: {
        id: request.request.id,
        status: 'CANCELLED_BY_SYSTEM',
        terminalReason: 'WITHDRAWN_PARTICIPANT',
      },
    });

    const staleRequest = await prisma.matchRequest.findUniqueOrThrow({
      where: { id: request.request.id },
    });
    expect(staleRequest).toMatchObject({
      status: 'CANCELLED_BY_SYSTEM',
      terminalReason: 'WITHDRAWN_PARTICIPANT',
    });
    expect(staleRequest.terminalAt).not.toBeNull();

    await expect(
      prisma.activeMatch.findFirst({
        where: {
          seasonId: 'season-integration',
          endedAt: null,
          OR: [{ participantAId: 'participant-a' }, { participantBId: 'participant-a' }],
        },
      }),
    ).resolves.toBeNull();

    const withdrawnParticipant = await prisma.seasonParticipant.findUniqueOrThrow({
      where: { id: 'participant-a' },
    });
    expect(withdrawnParticipant.participantStatus).toBe('WITHDRAWN');
    expect(withdrawnParticipant.matchedAt).toBeNull();
  });

  it('수락된 요청 외 같은 receiver의 다른 pending request는 system cancel된다', async () => {
    const requestA = await service.createMatchRequest(authContext('user-a'), {
      targetUserId: 'user-b',
      note: 'request-a',
    });
    const requestB = await service.createMatchRequest(authContext('user-c'), {
      targetUserId: 'user-b',
      note: 'request-b',
    });

    await service.acceptMatchRequest(authContext('user-b'), requestA.request.id);

    const accepted = await prisma.matchRequest.findUnique({
      where: { id: requestA.request.id },
    });
    const cancelled = await prisma.matchRequest.findUnique({
      where: { id: requestB.request.id },
    });

    expect(accepted).toMatchObject({
      status: 'ACCEPTED',
      terminalReason: 'ACCEPTED',
    });
    expect(cancelled).toMatchObject({
      status: 'CANCELLED_BY_SYSTEM',
      terminalReason: 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH',
    });
  });

  it('매칭 성공 시 matched pair thread 외 관련 open direct threads는 READ_ONLY가 되고 thread.updated outbox를 남긴다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-d',
      participantId: 'participant-d',
      email: 'user-d@kangwon.ac.kr',
      nickname: '유저라',
    });

    await prisma.conversationThread.createMany({
      data: [
        {
          id: 'thread-a-b-existing',
          seasonId: 'season-integration',
          pairKey: 'participant-a:participant-b',
          participantAId: 'participant-a',
          participantBId: 'participant-b',
          openedByParticipantId: 'participant-a',
          threadKind: 'DIRECT',
          status: 'OPEN',
        },
        {
          id: 'thread-a-c-other',
          seasonId: 'season-integration',
          pairKey: 'participant-a:participant-c',
          participantAId: 'participant-a',
          participantBId: 'participant-c',
          openedByParticipantId: 'participant-a',
          threadKind: 'DIRECT',
          status: 'OPEN',
        },
        {
          id: 'thread-b-d-other',
          seasonId: 'season-integration',
          pairKey: 'participant-b:participant-d',
          participantAId: 'participant-b',
          participantBId: 'participant-d',
          openedByParticipantId: 'participant-b',
          threadKind: 'DIRECT',
          status: 'OPEN',
        },
      ],
    });
    await prisma.conversationThreadMember.createMany({
      data: [
        { threadId: 'thread-a-b-existing', participantId: 'participant-a' },
        { threadId: 'thread-a-b-existing', participantId: 'participant-b' },
        { threadId: 'thread-a-c-other', participantId: 'participant-a' },
        { threadId: 'thread-a-c-other', participantId: 'participant-c' },
        { threadId: 'thread-b-d-other', participantId: 'participant-b' },
        { threadId: 'thread-b-d-other', participantId: 'participant-d' },
      ],
    });

    const request = await service.createMatchRequest(authContext('user-a'), {
      targetUserId: 'user-b',
      note: '기존 direct thread 승격과 다른 direct thread 종료',
    });

    await service.acceptMatchRequest(authContext('user-b'), request.request.id);

    const threads = await prisma.conversationThread.findMany({
      where: {
        id: { in: ['thread-a-b-existing', 'thread-a-c-other', 'thread-b-d-other'] },
      },
      orderBy: [{ id: 'asc' }],
    });
    const threadStates: Record<
      string,
      {
        threadKind: string;
        activeMatchId: string | null;
        status: string;
        closedReason: string | null;
      }
    > = {};
    for (const thread of threads) {
      threadStates[thread.id] = {
        threadKind: thread.threadKind,
        activeMatchId: thread.activeMatchId,
        status: thread.status,
        closedReason: thread.closedReason,
      };
    }
    expect(threadStates['thread-a-b-existing']?.activeMatchId).toEqual(expect.any(String));
    expect(threadStates).toMatchObject({
      'thread-a-b-existing': {
        threadKind: 'MATCHED',
        status: 'OPEN',
        closedReason: null,
      },
      'thread-a-c-other': {
        threadKind: 'DIRECT',
        activeMatchId: null,
        status: 'READ_ONLY',
        closedReason: 'ACTIVE_MATCH_CREATED',
      },
      'thread-b-d-other': {
        threadKind: 'DIRECT',
        activeMatchId: null,
        status: 'READ_ONLY',
        closedReason: 'ACTIVE_MATCH_CREATED',
      },
    });

    const outboxEvents = await prisma.chatRealtimeOutboxEvent.findMany({
      where: {
        eventType: 'chat.thread.updated',
        threadId: { in: ['thread-a-b-existing', 'thread-a-c-other', 'thread-b-d-other'] },
      },
      orderBy: [{ threadId: 'asc' }],
    });
    expect(outboxEvents.map((event) => event.threadId)).toEqual([
      'thread-a-b-existing',
      'thread-a-c-other',
      'thread-b-d-other',
    ]);
    expect(outboxEvents.map((event) => event.payload)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ threadId: 'thread-a-b-existing', status: 'OPEN' }),
        expect.objectContaining({
          threadId: 'thread-a-c-other',
          status: 'READ_ONLY',
          closedReason: 'ACTIVE_MATCH_CREATED',
        }),
        expect.objectContaining({
          threadId: 'thread-b-d-other',
          status: 'READ_ONLY',
          closedReason: 'ACTIVE_MATCH_CREATED',
        }),
      ]),
    );

    const activeMatchId = threadStates['thread-a-b-existing']?.activeMatchId;
    if (!activeMatchId) {
      throw new Error('Expected active match id on matched thread');
    }

    const lifecycleEvents = await prisma.conversationThreadLifecycleEvent.findMany({
      where: {
        threadId: { in: ['thread-a-b-existing', 'thread-a-c-other', 'thread-b-d-other'] },
      },
      orderBy: [{ threadId: 'asc' }],
    });
    expect(lifecycleEvents).toHaveLength(3);

    const lifecycleByThread = new Map(lifecycleEvents.map((event) => [event.threadId, event]));
    const matchedThreadLifecycleEvent = lifecycleByThread.get('thread-a-b-existing');
    expect(matchedThreadLifecycleEvent).toMatchObject({
      eventType: 'THREAD_KIND_CHANGED',
      reason: 'MATCH_REQUEST_ACCEPTED',
      sourceDomain: 'MATCHES',
      sourceActiveMatchId: activeMatchId,
      sourceMatchRequestId: request.request.id,
    });
    expect(matchedThreadLifecycleEvent?.metadata).toEqual(
      expect.objectContaining({
        previousThreadKind: 'DIRECT',
        nextThreadKind: 'MATCHED',
        previousStatus: 'OPEN',
        nextStatus: 'OPEN',
      }),
    );
    for (const threadId of ['thread-a-c-other', 'thread-b-d-other']) {
      const closedThreadLifecycleEvent = lifecycleByThread.get(threadId);
      expect(closedThreadLifecycleEvent).toMatchObject({
        eventType: 'THREAD_READ_ONLY',
        reason: 'MATCH_REQUEST_ACCEPTED',
        sourceDomain: 'MATCHES',
        sourceActiveMatchId: activeMatchId,
        sourceMatchRequestId: request.request.id,
      });
      expect(closedThreadLifecycleEvent?.metadata).toEqual(
        expect.objectContaining({
          previousThreadKind: 'DIRECT',
          nextThreadKind: 'DIRECT',
          previousStatus: 'OPEN',
          nextStatus: 'READ_ONLY',
          nextClosedReason: 'ACTIVE_MATCH_CREATED',
        }),
      );
    }
  });

  it('incomplete season participant profile은 raw nullable write가 가능해도 match request capability에서 닫힌다', async () => {
    await prisma.seasonParticipantProfile.update({
      where: { participantId: 'participant-a' },
      data: {
        smokingTolerance: null,
      },
    });

    await expect(
      service.createMatchRequest(authContext('user-a'), {
        targetUserId: 'user-b',
        note: 'incomplete requester profile',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'MATCH_REQUEST_NOT_ALLOWED',
      },
    });
  });

  it('ACTIVE match summary의 match score는 viewer 기준 단방향으로 계산된다', async () => {
    await seedActiveMatchFixture(prisma, {
      activeMatchId: 'active-a-b',
      participantAId: 'participant-a',
      participantBId: 'participant-b',
    });

    await prisma.seasonParticipantProfile.update({
      where: { participantId: 'participant-a' },
      data: {
        ...toCompleteLifestyleColumnData({
          ...DEFAULT_LIFESTYLE,
          cleanExpectation: 'STRICT',
          cleanLevel: 'WEEKLY_3_UP',
        }),
      },
    });
    await prisma.seasonParticipantProfile.update({
      where: { participantId: 'participant-b' },
      data: {
        ...toCompleteLifestyleColumnData({
          ...DEFAULT_LIFESTYLE,
          cleanExpectation: 'FLEXIBLE',
          cleanLevel: 'WHEN_DIRTY',
        }),
      },
    });

    const activeForA = await service.getCurrentActiveMatch(authContext('user-a'));
    const activeForB = await service.getCurrentActiveMatch(authContext('user-b'));

    expect(activeForA.activeMatch?.matchScore).toEqual(expect.any(Number));
    expect(activeForB.activeMatch?.matchScore).toEqual(expect.any(Number));
    expect(activeForA.activeMatch?.matchScore).not.toBe(activeForB.activeMatch?.matchScore);
  });
});

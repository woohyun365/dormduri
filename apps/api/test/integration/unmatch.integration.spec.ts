import { MatchesService } from '../../src/matches/matches.service.js';
import { ChatService } from '../../src/chat/chat.service.js';
import { PrismaService } from '../../src/common/prisma/prisma.service.js';
import { createIntegrationApp } from './support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from './support/integration-db.js';
import {
  authContext,
  seedActiveMatchFixture,
  seedBaseSeasonFixtures,
  seedRegisteredAssignedParticipant,
} from './support/integration-fixtures.js';

describe('MatchesService unmatch integration', () => {
  jest.setTimeout(60_000);

  let prisma: PrismaService;
  let service: MatchesService;
  let chatService: ChatService;
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
      nickname: '유저A',
    });
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-b',
      participantId: 'participant-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '유저B',
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
});

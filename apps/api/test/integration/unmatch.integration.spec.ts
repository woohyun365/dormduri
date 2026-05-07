import { MatchesService } from '../../src/matches/matches.service.js';
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
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const sandbox = await createIntegrationDatabaseSandbox('unmatch_integration');
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
});

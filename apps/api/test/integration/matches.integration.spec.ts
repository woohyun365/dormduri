import { MatchesService } from '../../src/matches/matches.service.js';
import { PrismaService } from '../../src/common/prisma/prisma.service.js';
import { createIntegrationApp } from './support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from './support/integration-db.js';
import {
  authContext,
  seedBaseSeasonFixtures,
  seedRegisteredAssignedParticipant,
} from './support/integration-fixtures.js';

describe('MatchesService integration', () => {
  jest.setTimeout(60_000);

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
      nickname: '유저A',
    });
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-b',
      participantId: 'participant-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '유저B',
    });
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-c',
      participantId: 'participant-c',
      email: 'user-c@kangwon.ac.kr',
      nickname: '유저C',
    });
  });

  it('같은 pair로 동시에 request를 생성해도 pending request는 하나만 남는다', async () => {
    const first = service.createMatchRequest(authContext('user-a'), {
      targetUserId: 'user-b',
      note: '같은 pair race 1',
      channel: 'PROFILE_DETAIL',
    });
    const second = service.createMatchRequest(authContext('user-a'), {
      targetUserId: 'user-b',
      note: '같은 pair race 2',
      channel: 'PROFILE_DETAIL',
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
      channel: 'PROFILE_DETAIL',
    });
    const requestB = await service.createMatchRequest(authContext('user-c'), {
      targetUserId: 'user-b',
      note: 'request-b',
      channel: 'PROFILE_DETAIL',
    });

    const settled = await Promise.allSettled([
      service.acceptMatchRequest(authContext('user-b'), requestA.request.id),
      service.acceptMatchRequest(authContext('user-b'), requestB.request.id),
    ]);

    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter((result) => result.status === 'rejected')).toHaveLength(1);

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
  });
});

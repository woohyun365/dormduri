import { UsersService } from '../../src/users/users.service.js';
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

describe('UsersService integration', () => {
  jest.setTimeout(60_000);

  let prisma: PrismaService;
  let service: UsersService;
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const sandbox = await createIntegrationDatabaseSandbox('users_integration');
    cleanupDb = sandbox.cleanup;

    const { app, prisma: prismaService } = await createIntegrationApp();
    closeApp = () => app.close();
    prisma = prismaService;
    service = app.get(UsersService);
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

    await prisma.seasonParticipant.update({
      where: { id: 'participant-a' },
      data: {
        dormitoryId: null,
        dormitorySelectionState: 'NOT_SELECTED',
        participantStatus: 'DRAFT',
        activatedAt: null,
      },
    });
  });

  it('current user 응답에서는 drinking 필드가 lifestyle에 포함되어 self read가 가능하다', async () => {
    const currentUser = await service.getCurrentUser(authContext('user-a'));

    expect(currentUser.profile.lifestyle.drinkingFrequency).toBe('NONE');
    expect(currentUser.profile.lifestyle.drinkingTolerance).toBe('LOW_ONLY');
  });

  it('selection ASSIGNED update는 SeasonParticipant를 ACTIVE 상태로 맞춘다', async () => {
    await service.updateCurrentUser(authContext('user-a'), {
      selection: {
        state: 'ASSIGNED',
        dormitoryId: 'dasan',
      },
    });

    const participant = await prisma.seasonParticipant.findUnique({
      where: { id: 'participant-a' },
    });

    expect(participant).toMatchObject({
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
      participantStatus: 'ACTIVE',
    });
    expect(participant?.activatedAt).not.toBeNull();
  });
});

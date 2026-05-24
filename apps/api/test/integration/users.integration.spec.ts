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

  it('current user 응답은 season profile lifestyle 본문을 직접 포함하지 않고 상태 segment만 조합한다', async () => {
    const currentUser = await service.getCurrentUser(authContext('user-a'));

    expect(currentUser.user).toMatchObject({
      id: 'user-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
    });
    expect(currentUser.displayIdentity).toMatchObject({
      userId: 'user-a',
      nickname: '유저A',
      nicknameSource: 'USER_DISPLAY_IDENTITY',
    });
    expect(currentUser.seasonProfile).toMatchObject({
      hasParticipantRow: true,
      registered: false,
      profileExists: true,
      profileState: 'COMPLETE',
    });
    expect(currentUser.selection).toMatchObject({
      state: 'NOT_SELECTED',
      dormitoryId: null,
      source: 'SEASON_PARTICIPANT',
    });
    expect(currentUser).not.toHaveProperty('profile');
  });

  it('display identity 수정은 users 도메인만 변경하고 dormitory selection은 건드리지 않는다', async () => {
    await service.updateCurrentUser(authContext('user-a'), {
      displayIdentity: { nickname: '유저변경' },
    });

    const participant = await prisma.seasonParticipant.findUnique({
      where: { id: 'participant-a' },
    });
    const displayIdentity = await prisma.userDisplayIdentity.findUnique({
      where: { userId: 'user-a' },
    });

    expect(participant).toMatchObject({
      dormitoryId: null,
      dormitorySelectionState: 'NOT_SELECTED',
      participantStatus: 'DRAFT',
    });
    expect(participant?.activatedAt).toBeNull();
    expect(displayIdentity).toMatchObject({
      nickname: '유저변경',
      nicknameNormalized: '유저변경',
    });
  });
});

import { PrismaService } from '../../src/common/prisma/prisma.service.js';
import { ProfilesService } from '../../src/profiles/profiles.service.js';
import { createIntegrationApp } from './support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from './support/integration-db.js';
import {
  authContext,
  DEFAULT_LIFESTYLE,
  seedBaseSeasonFixtures,
  seedRegisteredAssignedParticipant,
} from './support/integration-fixtures.js';

describe('ProfilesService mutation integration', () => {
  jest.setTimeout(60_000);

  let prisma: PrismaService;
  let service: ProfilesService;
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const sandbox = await createIntegrationDatabaseSandbox('profiles_mutation_integration');
    cleanupDb = sandbox.cleanup;

    const { app, prisma: prismaService } = await createIntegrationApp();
    closeApp = () => app.close();
    prisma = prismaService;
    service = app.get(ProfilesService);
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
  });

  it('SEASON_OPEN 등록 사용자는 complete 상태를 유지하는 조건 수정만 허용한다', async () => {
    const now = await prisma.getDatabaseNow();
    await prisma.season.update({
      where: { id: 'season-integration' },
      data: {
        overrideState: 'SEASON_OPEN',
        overrideStartedAt: now,
        overrideEndsAt: null,
      },
    });

    await service.updateLifestyle(authContext('user-a'), {
      ...DEFAULT_LIFESTYLE,
      smokingTolerance: 'ANY',
    });

    const participantProfile = await prisma.seasonParticipantProfile.findUnique({
      where: { participantId: 'participant-a' },
    });

    expect(participantProfile?.lifestyle).toEqual(
      expect.objectContaining({
        smokingTolerance: 'ANY',
      }),
    );
  });

  it('SEASON_OPEN 등록 사용자는 season profile에 null을 다시 저장할 수 없다', async () => {
    const now = await prisma.getDatabaseNow();
    await prisma.season.update({
      where: { id: 'season-integration' },
      data: {
        overrideState: 'SEASON_OPEN',
        overrideStartedAt: now,
        overrideEndsAt: null,
      },
    });

    await expect(
      service.updateLifestyle(authContext('user-a'), {
        ...DEFAULT_LIFESTYLE,
        smokingTolerance: null,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'INVALID_LIFESTYLE_PAYLOAD',
      },
    });
  });

  it('SEASON_MATCHING 등록 사용자는 season profile lifestyle/condition 수정이 막힌다', async () => {
    await expect(
      service.updateLifestyle(authContext('user-a'), {
        ...DEFAULT_LIFESTYLE,
        smokingTolerance: 'ANY',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'PROFILE_EDIT_LOCKED',
      },
    });
  });
});

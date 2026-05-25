import { UsersService } from '../../src/users/users.service.js';
import { usersErrors } from '../../src/users/users.errors.js';
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

  it('현재 시즌 registration 완료 사용자의 display identity nickname 변경은 season lock으로 거부한다', async () => {
    const now = await prisma.getDatabaseNow();
    await prisma.seasonParticipant.update({
      where: { id: 'participant-a' },
      data: {
        participationIntent: 'REGISTERED',
        registeredAt: now,
        declinedAt: null,
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
        participantStatus: 'ACTIVE',
        activatedAt: now,
        withdrawnAt: null,
      },
    });

    await expect(
      service.updateCurrentUser(authContext('user-a'), {
        displayIdentity: { nickname: '등록후변경' },
      }),
    ).rejects.toMatchObject({
      response: usersErrors.nicknameLockedBySeason().getResponse(),
    });

    const currentUser = await service.getCurrentUser(authContext('user-a'));
    expect(currentUser.capabilities).toMatchObject({
      canEditDisplayIdentity: false,
      displayIdentityEditUnavailableReasons: ['CURRENT_SEASON_REGISTRATION_LOCK'],
    });

    const displayIdentity = await prisma.userDisplayIdentity.findUniqueOrThrow({
      where: { userId: 'user-a' },
    });
    expect(displayIdentity.nickname).toBe('유저A');
  });

  it('같은 display identity nickname 저장은 registration lock 중에도 no-op metadata로 성공한다', async () => {
    const now = await prisma.getDatabaseNow();
    await prisma.userDisplayIdentity.update({
      where: { userId: 'user-a' },
      data: { nicknameNormalized: '유저a' },
    });
    await prisma.seasonParticipant.update({
      where: { id: 'participant-a' },
      data: {
        participationIntent: 'REGISTERED',
        registeredAt: now,
        declinedAt: null,
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
        participantStatus: 'ACTIVE',
        activatedAt: now,
        withdrawnAt: null,
      },
    });

    const response = await service.updateCurrentUser(authContext('user-a'), {
      displayIdentity: { nickname: '유저A' },
    });

    expect(response.mutation.displayIdentity).toEqual({
      attempted: true,
      changed: false,
      noOpReason: 'SAME_NICKNAME',
    });
    expect(response.currentUser.displayIdentity.nickname).toBe('유저A');
  });

  it('철회된 사용자는 같은 시즌 재등록 불가 상태이므로 display identity nickname 변경은 다시 허용한다', async () => {
    const now = await prisma.getDatabaseNow();
    await prisma.seasonParticipant.update({
      where: { id: 'participant-a' },
      data: {
        participationIntent: 'DECLINED',
        declinedAt: now,
        participantStatus: 'WITHDRAWN',
        withdrawnAt: now,
      },
    });

    await service.updateCurrentUser(authContext('user-a'), {
      displayIdentity: { nickname: '철회후변경' },
    });

    const displayIdentity = await prisma.userDisplayIdentity.findUniqueOrThrow({
      where: { userId: 'user-a' },
    });
    expect(displayIdentity.nickname).toBe('철회후변경');
  });
});

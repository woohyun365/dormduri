import { AuthLoginAttemptService } from '../../src/auth/auth-login-attempt.service.js';
import { ChatService } from '../../src/chat/chat.service.js';
import { PrismaService } from '../../src/common/prisma/prisma.service.js';
import { MatchesService } from '../../src/matches/matches.service.js';
import { UsersService } from '../../src/users/users.service.js';
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

function waitMs(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('timestamp field integration', () => {
  jest.setTimeout(60_000);

  let prisma: PrismaService;
  let loginAttemptService: AuthLoginAttemptService;
  let usersService: UsersService;
  let matchesService: MatchesService;
  let chatService: ChatService;
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const sandbox = await createIntegrationDatabaseSandbox('timestamps_integration');
    cleanupDb = sandbox.cleanup;

    const { app, prisma: prismaService } = await createIntegrationApp();
    closeApp = () => app.close();
    prisma = prismaService;
    loginAttemptService = app.get(AuthLoginAttemptService);
    usersService = app.get(UsersService);
    matchesService = app.get(MatchesService);
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
  });

  it('DB trigger는 raw SQL update에서도 User.updatedAt을 갱신한다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
    });

    const before = await prisma.user.findUniqueOrThrow({ where: { id: 'user-a' } });
    await waitMs(10);
    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET "email" = $1 WHERE id = $2`,
      'raw-update@kangwon.ac.kr',
      'user-a',
    );
    const after = await prisma.user.findUniqueOrThrow({ where: { id: 'user-a' } });

    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });

  it('SQL helper 기반 login failure는 lastFailedAt/updatedAt을 갱신하고 임계치에서 lockedUntil을 세운다', async () => {
    await loginAttemptService.recordLoginFailure('lock-target@kangwon.ac.kr');
    const first = await prisma.loginAttempt.findUniqueOrThrow({
      where: { emailNormalized: 'lock-target@kangwon.ac.kr' },
    });

    expect(first.failureCount).toBe(1);
    expect(first.lastFailedAt).not.toBeNull();

    await waitMs(10);
    for (let i = 0; i < 4; i += 1) {
      await loginAttemptService.recordLoginFailure('lock-target@kangwon.ac.kr');
    }

    const after = await prisma.loginAttempt.findUniqueOrThrow({
      where: { emailNormalized: 'lock-target@kangwon.ac.kr' },
    });

    expect(after.updatedAt.getTime()).toBeGreaterThan(first.updatedAt.getTime());
    expect(after.lastFailedAt!.getTime()).toBeGreaterThan(first.lastFailedAt!.getTime());
    expect(after.failureCount).toBe(5);
    expect(after.lockedUntil).not.toBeNull();
  });

  it('business logic는 selection/active match/chat 흐름의 .*At 필드를 채운다', async () => {
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

    await prisma.user.update({
      where: { id: 'user-a' },
      data: { dormitoryId: null, dormitorySelectionState: 'NOT_SELECTED' },
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

    await usersService.updateCurrentUser(authContext('user-a'), {
      selection: {
        state: 'ASSIGNED',
        dormitoryId: 'dasan',
      },
    });

    const activatedParticipant = await prisma.seasonParticipant.findUniqueOrThrow({
      where: { id: 'participant-a' },
    });
    expect(activatedParticipant.activatedAt).not.toBeNull();

    await seedActiveMatchFixture(prisma, {
      activeMatchId: 'active-ts',
      participantAId: 'participant-a',
      participantBId: 'participant-b',
      withMatchedThread: true,
    });

    await matchesService.requestUnmatch(authContext('user-a'), 'active-ts');
    const pendingUnmatch = await prisma.activeMatchUnmatchRequest.findFirstOrThrow({
      where: {
        activeMatchId: 'active-ts',
        participantId: 'participant-a',
      },
    });
    expect(pendingUnmatch.requestedAt).not.toBeNull();

    await matchesService.requestUnmatch(authContext('user-b'), 'active-ts');
    const fulfilled = await prisma.activeMatchUnmatchRequest.findMany({
      where: { activeMatchId: 'active-ts' },
      orderBy: [{ requestedAt: 'asc' }],
    });
    expect(fulfilled.every((row) => row.terminalAt !== null)).toBe(true);

    const endedMatch = await prisma.activeMatch.findUniqueOrThrow({
      where: { id: 'active-ts' },
    });
    expect(endedMatch.endedAt).not.toBeNull();

    await chatService.sendMessage(authContext('user-a'), {
      targetUserId: 'user-b',
      body: 'timestamp check message',
    });
    const thread = await prisma.conversationThread.findFirstOrThrow({
      where: { pairKey: 'participant-a:participant-b' },
    });
    expect(thread.lastMessageAt).not.toBeNull();
  });
});

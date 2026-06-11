import { ChatService } from '../../src/chat/application/chat.service.js';
import { PrismaService } from '../../src/platform/database/prisma.service.js';
import { MatchesService } from '../../src/matches/application/matches.service.js';
import { SeasonsService } from '../../src/seasons/application/seasons.service.js';
import { formatKstDate, subtractDays } from '../../src/platform/time/kst-date.js';
import { createIntegrationApp } from './support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from './support/integration-db.js';
import {
  authContext,
  seedActiveMatchFixture,
  seedRegisteredAssignedParticipant,
} from './support/integration-fixtures.js';

describe('KST boundary + DB now integration', () => {
  jest.setTimeout(60_000);

  let prisma: PrismaService;
  let seasonsService: SeasonsService;
  let chatService: ChatService;
  let matchesService: MatchesService;
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const sandbox = await createIntegrationDatabaseSandbox('time_boundary_integration');
    cleanupDb = sandbox.cleanup;

    const { app, prisma: prismaService } = await createIntegrationApp();
    closeApp = () => app.close();
    prisma = prismaService;
    seasonsService = app.get(SeasonsService);
    chatService = app.get(ChatService);
    matchesService = app.get(MatchesService);
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
  });

  function toDateOnlyValue(dateStr: string) {
    return new Date(`${dateStr}T00:00:00.000Z`);
  }

  async function seedBoundarySeason(input: { roomSelectionDate: string; seasonEndDate: string }) {
    const databaseNow = await prisma.getDatabaseNow();
    const today = formatKstDate(databaseNow);
    await prisma.campusMaster.create({
      data: {
        code: 'CHUNCHEON',
        nameKo: '춘천캠퍼스',
        isOperated: true,
        sortOrder: 1,
      },
    });
    await prisma.dormitory.create({
      data: {
        id: 'dasan',
        campusCode: 'CHUNCHEON',
        nameKo: '다산관',
        roomType: 2,
        genderPolicy: 'M',
        sortOrder: 1,
      },
    });
    await prisma.collegeMaster.create({
      data: {
        code: 'ARTS_ENGINEERING',
        campusCode: 'CHUNCHEON',
        nameKo: '문화예술공과대학',
        sortOrder: 1,
      },
    });
    await prisma.season.create({
      data: {
        id: 'season-boundary',
        campusCode: 'CHUNCHEON',
        academicYear: 2026,
        semester: 1,
        name: '2026-boundary',
        preparationStartDate: toDateOnlyValue(subtractDays(today, 30)),
        matchingStartDate: toDateOnlyValue(subtractDays(today, 5)),
        seasonEndDate: toDateOnlyValue(input.seasonEndDate),
      },
    });
    await prisma.seasonDormitoryOperation.create({
      data: {
        seasonId: 'season-boundary',
        dormitoryId: 'dasan',
        isOperated: true,
        roomSelectionDate: toDateOnlyValue(input.roomSelectionDate),
      },
    });
  }

  it('DB now의 KST 오늘이 roomSelectionDate와 같으면 current season state는 SEASON_MATCHING이다', async () => {
    const databaseNow = await prisma.getDatabaseNow();
    const today = formatKstDate(databaseNow);

    await seedBoundarySeason({
      roomSelectionDate: today,
      seasonEndDate: today,
    });

    const result = await seasonsService.getCurrentSeasonContext('CHUNCHEON');

    expect(result?.state).toBe('SEASON_MATCHING');
    expect(result?.schedule.matchingEnd).toBe(today);
  });

  it('DB now의 KST 오늘이 seasonEndDate이고 roomSelectionDate는 어제면 current season state는 SEASON_POST_MATCH다', async () => {
    const databaseNow = await prisma.getDatabaseNow();
    const today = formatKstDate(databaseNow);

    await seedBoundarySeason({
      roomSelectionDate: subtractDays(today, 1),
      seasonEndDate: today,
    });

    const result = await seasonsService.getCurrentSeasonContext('CHUNCHEON');

    expect(result?.state).toBe('SEASON_POST_MATCH');
    expect(result?.schedule.seasonEnd).toBe(today);
  });

  it('DB now의 KST 날짜가 seasonEndDate 당일이면 matched thread는 아직 writable하다', async () => {
    const databaseNow = await prisma.getDatabaseNow();
    const today = formatKstDate(databaseNow);

    await seedBoundarySeason({
      roomSelectionDate: subtractDays(today, 1),
      seasonEndDate: today,
    });
    await seedRegisteredAssignedParticipant(prisma, {
      seasonId: 'season-boundary',
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
    });
    await seedRegisteredAssignedParticipant(prisma, {
      seasonId: 'season-boundary',
      userId: 'user-b',
      participantId: 'participant-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '유저B',
    });
    await seedActiveMatchFixture(prisma, {
      seasonId: 'season-boundary',
      activeMatchId: 'active-boundary',
      participantAId: 'participant-a',
      participantBId: 'participant-b',
      withMatchedThread: true,
    });

    const result = await chatService.getThreadDetail(
      authContext('user-a'),
      'active-boundary-thread',
    );

    expect(result.thread.status).toBe('OPEN');
    expect(result.thread.canSendMessage).toBe(true);
  });

  it('DB now의 KST 날짜가 seasonEndDate 다음 날이면 matched thread는 read-only가 된다', async () => {
    const databaseNow = await prisma.getDatabaseNow();
    const today = formatKstDate(databaseNow);

    await seedBoundarySeason({
      roomSelectionDate: subtractDays(today, 2),
      seasonEndDate: subtractDays(today, 1),
    });
    await seedRegisteredAssignedParticipant(prisma, {
      seasonId: 'season-boundary',
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
    });
    await seedRegisteredAssignedParticipant(prisma, {
      seasonId: 'season-boundary',
      userId: 'user-b',
      participantId: 'participant-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '유저B',
    });
    await seedActiveMatchFixture(prisma, {
      seasonId: 'season-boundary',
      activeMatchId: 'active-boundary',
      participantAId: 'participant-a',
      participantBId: 'participant-b',
      withMatchedThread: true,
    });

    const result = await chatService.getThreadDetail(
      authContext('user-a'),
      'active-boundary-thread',
    );

    expect(result.thread.status).toBe('READ_ONLY');
    expect(result.thread.canSendMessage).toBe(false);
    expect(result.thread.sendMessageUnavailableReason).toBe('SEASON_ENDED');
  });

  it('DB now의 KST 오늘이 roomSelectionDate와 같으면 match request는 아직 허용된다', async () => {
    const databaseNow = await prisma.getDatabaseNow();
    const today = formatKstDate(databaseNow);

    await seedBoundarySeason({
      roomSelectionDate: today,
      seasonEndDate: today,
    });
    await seedRegisteredAssignedParticipant(prisma, {
      seasonId: 'season-boundary',
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
    });
    await seedRegisteredAssignedParticipant(prisma, {
      seasonId: 'season-boundary',
      userId: 'user-b',
      participantId: 'participant-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '유저B',
    });

    const result = await matchesService.createMatchRequest(authContext('user-a'), {
      targetUserId: 'user-b',
      note: 'boundary request',
    });

    expect(result.request.status).toBe('PENDING');
  });

  it('DB now의 KST 날짜가 roomSelectionDate 다음 날이면 direct thread는 read-only가 된다', async () => {
    const databaseNow = await prisma.getDatabaseNow();
    const today = formatKstDate(databaseNow);

    await seedBoundarySeason({
      roomSelectionDate: subtractDays(today, 1),
      seasonEndDate: today,
    });
    await seedRegisteredAssignedParticipant(prisma, {
      seasonId: 'season-boundary',
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
    });
    await seedRegisteredAssignedParticipant(prisma, {
      seasonId: 'season-boundary',
      userId: 'user-b',
      participantId: 'participant-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '유저B',
    });
    await prisma.conversationThread.create({
      data: {
        id: 'direct-boundary-thread',
        seasonId: 'season-boundary',
        pairKey: 'participant-a:participant-b',
        participantAId: 'participant-a',
        participantBId: 'participant-b',
        openedByParticipantId: 'participant-a',
        threadKind: 'DIRECT',
        status: 'OPEN',
      },
    });
    await prisma.conversationThreadMember.createMany({
      data: [
        { threadId: 'direct-boundary-thread', participantId: 'participant-a' },
        { threadId: 'direct-boundary-thread', participantId: 'participant-b' },
      ],
    });

    const result = await chatService.getThreadDetail(
      authContext('user-a'),
      'direct-boundary-thread',
    );

    expect(result.thread.status).toBe('READ_ONLY');
    expect(result.thread.canSendMessage).toBe(false);
    expect(result.thread.sendMessageUnavailableReason).toBe('THREAD_READ_ONLY');
  });
});

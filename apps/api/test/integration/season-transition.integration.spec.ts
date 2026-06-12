import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ChatService } from '../../src/chat/application/chat.service.js';
import { LifecycleSweepService } from '../../src/lifecycle/lifecycle-sweep.service.js';
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

describe('Season transition integration', () => {
  let appContext: Awaited<ReturnType<typeof createIntegrationApp>> | null = null;
  let prisma: PrismaService;
  let chatService: ChatService;
  let lifecycleSweepService: LifecycleSweepService;
  let matchesService: MatchesService;
  let seasonsService: SeasonsService;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const sandbox = await createIntegrationDatabaseSandbox('season_transition_integration');
    cleanupDb = sandbox.cleanup;

    appContext = await createIntegrationApp();
    prisma = appContext.prisma;
    chatService = appContext.app.get(ChatService);
    lifecycleSweepService = appContext.app.get(LifecycleSweepService);
    matchesService = appContext.app.get(MatchesService);
    seasonsService = appContext.app.get(SeasonsService);
  });

  afterAll(async () => {
    if (appContext) {
      await appContext.app.close();
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

  function addDays(dateStr: string, days: number) {
    return subtractDays(dateStr, -days);
  }

  async function seedCampusDormitory() {
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
  }

  async function seedSeason(input: {
    id: string;
    preparationStartDate: string;
    matchingStartDate: string;
    seasonEndDate: string;
    roomSelectionDate: string;
    academicYear?: number;
    semester?: number;
    overrideState?: 'OFF_SEASON' | 'SEASON_OPEN' | 'SEASON_MATCHING' | 'SEASON_POST_MATCH' | null;
    overrideStartedAt?: Date | null;
    overrideEndsAt?: Date | null;
    overrideReason?: string | null;
  }) {
    await prisma.season.create({
      data: {
        id: input.id,
        campusCode: 'CHUNCHEON',
        academicYear: input.academicYear ?? 2026,
        semester: input.semester ?? 1,
        name: input.id,
        preparationStartDate: toDateOnlyValue(input.preparationStartDate),
        matchingStartDate: toDateOnlyValue(input.matchingStartDate),
        seasonEndDate: toDateOnlyValue(input.seasonEndDate),
        overrideState: input.overrideState ?? null,
        overrideStartedAt: input.overrideStartedAt ?? null,
        overrideEndsAt: input.overrideEndsAt ?? null,
        overrideReason: input.overrideReason ?? null,
      },
    });

    await prisma.seasonDormitoryOperation.create({
      data: {
        seasonId: input.id,
        dormitoryId: 'dasan',
        isOperated: true,
        roomSelectionDate: toDateOnlyValue(input.roomSelectionDate),
      },
    });
  }

  it('season override API는 active override를 current season read model에 반영하고 만료 후 schedule로 복귀한다', async () => {
    if (!appContext) {
      throw new Error('integration app not initialized');
    }

    const databaseNow = await prisma.getDatabaseNow();
    const today = formatKstDate(databaseNow);

    await seedCampusDormitory();
    await seedSeason({
      id: 'season-override',
      preparationStartDate: subtractDays(today, 30),
      matchingStartDate: subtractDays(today, 5),
      seasonEndDate: addDays(today, 10),
      roomSelectionDate: addDays(today, 5),
      overrideState: 'OFF_SEASON',
      overrideStartedAt: new Date(databaseNow.getTime() - 60_000),
      overrideEndsAt: new Date(databaseNow.getTime() + 60_000),
      overrideReason: '운영자 수동 비활성화',
    });

    const httpServer = appContext.app.getHttpServer() as Parameters<typeof request>[0];
    const overrideResponse = await request(httpServer)
      .get('/api/seasons/current')
      .query({ campus: 'CHUNCHEON' })
      .expect(200);
    const overrideBody = overrideResponse.body as {
      state: string;
      override: {
        active: boolean;
        state: string | null;
        reason: string | null;
      };
    };

    expect(overrideBody.state).toBe('OFF_SEASON');
    expect(overrideBody.override).toMatchObject({
      active: true,
      state: 'OFF_SEASON',
      reason: '운영자 수동 비활성화',
    });

    await prisma.season.update({
      where: { id: 'season-override' },
      data: {
        overrideEndsAt: new Date(databaseNow.getTime() - 1_000),
      },
    });

    const scheduledResponse = await request(httpServer)
      .get('/api/seasons/current')
      .query({ campus: 'CHUNCHEON' })
      .expect(200);
    const scheduledBody = scheduledResponse.body as {
      state: string;
      override: {
        active: boolean;
      };
      schedule: {
        matchingEnd: string;
      };
    };

    expect(scheduledBody.state).toBe('SEASON_MATCHING');
    expect(scheduledBody.override.active).toBe(false);
    expect(scheduledBody.schedule.matchingEnd).toBe(addDays(today, 5));
  });

  it('비시즌의 지난 시즌 read-only matched thread는 새 current season이 열리면 archive되고 verified user는 새 season participant row를 eager create한다', async () => {
    const databaseNow = await prisma.getDatabaseNow();
    const today = formatKstDate(databaseNow);

    await seedCampusDormitory();
    await seedSeason({
      id: 'season-old',
      academicYear: 2025,
      semester: 2,
      preparationStartDate: subtractDays(today, 60),
      matchingStartDate: subtractDays(today, 40),
      seasonEndDate: subtractDays(today, 1),
      roomSelectionDate: subtractDays(today, 2),
    });

    await seedRegisteredAssignedParticipant(prisma, {
      seasonId: 'season-old',
      userId: 'user-a',
      participantId: 'participant-old-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
    });
    await seedRegisteredAssignedParticipant(prisma, {
      seasonId: 'season-old',
      userId: 'user-b',
      participantId: 'participant-old-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '유저B',
    });
    await seedActiveMatchFixture(prisma, {
      seasonId: 'season-old',
      activeMatchId: 'old-active',
      participantAId: 'participant-old-a',
      participantBId: 'participant-old-b',
      withMatchedThread: true,
    });

    const offSeasonSweep = await lifecycleSweepService.runBoundarySweep(databaseNow);
    expect(offSeasonSweep.matchTransitions.seasonEndedActiveMatches).toBe(1);
    expect(offSeasonSweep.threadTransitions.updatedCount).toBeGreaterThanOrEqual(1);

    const offSeasonActiveMatch = await prisma.activeMatch.findUnique({
      where: { id: 'old-active' },
    });
    expect(offSeasonActiveMatch?.status).toBe('SEASON_ENDED');
    expect(offSeasonActiveMatch?.endedAt).not.toBeNull();

    const offSeasonThread = await prisma.conversationThread.findUnique({
      where: { id: 'old-active-thread' },
    });
    expect(offSeasonThread?.status).toBe('READ_ONLY');

    expect(offSeasonSweep.matchHistory.rebuiltEntries).toBeGreaterThanOrEqual(2);

    const offSeasonHistory = await matchesService.getMatchHistory(authContext('user-a'));
    expect(offSeasonHistory.items).toHaveLength(1);
    expect(offSeasonHistory.items[0]).toMatchObject({
      seasonId: 'season-old',
      seasonName: 'season-old',
      viewerParticipantId: 'participant-old-a',
      viewerDormitoryIdSnapshot: 'dasan',
      finalResult: 'MATCHED_SUCCESS',
      sentRequestCount: 1,
      receivedRequestCount: 0,
    });
    expect(offSeasonHistory.items[0]?.history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          counterpartParticipantId: 'participant-old-b',
          counterpartNickname: '유저B',
          stage: 'MATCH',
          result: 'MATCHED_SUCCESS',
          activeMatchEndReason: 'SEASON_ENDED',
        }),
      ]),
    );

    await seedSeason({
      id: 'season-new',
      academicYear: 2026,
      semester: 1,
      preparationStartDate: today,
      matchingStartDate: addDays(today, 5),
      seasonEndDate: addDays(today, 30),
      roomSelectionDate: addDays(today, 20),
    });

    expect(
      await prisma.seasonParticipant.findUnique({
        where: {
          seasonId_userId: {
            seasonId: 'season-new',
            userId: 'user-a',
          },
        },
      }),
    ).toBeNull();

    const openSeasonSweep = await lifecycleSweepService.runBoundarySweep(databaseNow);
    const newSeasonBackfill = openSeasonSweep.participantBackfill.find(
      (entry) => entry.seasonId === 'season-new',
    );
    expect(newSeasonBackfill).toBeDefined();
    expect(typeof newSeasonBackfill?.createdCount).toBe('number');

    const createdParticipant = await prisma.seasonParticipant.findUnique({
      where: {
        seasonId_userId: {
          seasonId: 'season-new',
          userId: 'user-a',
        },
      },
    });
    expect(createdParticipant).toMatchObject({
      seasonId: 'season-new',
      userId: 'user-a',
      participationIntent: 'UNDECIDED',
      participantStatus: 'NOT_STARTED',
    });

    const archivedThreads = await chatService.listThreads(authContext('user-a'));
    expect(archivedThreads.items).toHaveLength(0);

    const archivedThread = await prisma.conversationThread.findUnique({
      where: { id: 'old-active-thread' },
    });
    expect(archivedThread?.status).toBe('ARCHIVED');

    await prisma.userDisplayIdentity.update({
      where: { userId: 'user-b' },
      data: {
        nickname: '바뀐닉네임',
        nicknameNormalized: '바뀐닉네임',
      },
    });

    const frozenHistory = await matchesService.getMatchHistory(authContext('user-a'));
    expect(frozenHistory.items[0]?.history[0]?.counterpartNickname).toBe('유저B');
  });

  it('SEASON_POST_MATCH 경계에서는 pending request와 pending unmatch request가 각각 terminal state로 정리된다', async () => {
    const databaseNow = await prisma.getDatabaseNow();
    const today = formatKstDate(databaseNow);

    await seedCampusDormitory();
    await seedSeason({
      id: 'season-post-match',
      preparationStartDate: subtractDays(today, 30),
      matchingStartDate: subtractDays(today, 5),
      seasonEndDate: today,
      roomSelectionDate: subtractDays(today, 1),
    });

    await seedRegisteredAssignedParticipant(prisma, {
      seasonId: 'season-post-match',
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
    });
    await seedRegisteredAssignedParticipant(prisma, {
      seasonId: 'season-post-match',
      userId: 'user-b',
      participantId: 'participant-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '유저B',
    });

    await prisma.matchRequest.create({
      data: {
        id: 'pending-request-1',
        seasonId: 'season-post-match',
        pairKey: 'participant-a:participant-b',
        pairMinParticipantId: 'participant-a',
        pairMaxParticipantId: 'participant-b',
        requesterParticipantId: 'participant-a',
        receiverParticipantId: 'participant-b',
        status: 'PENDING',
        createdAt: new Date(databaseNow.getTime() - 24 * 60 * 60 * 1_000),
        expiresAt: new Date(databaseNow.getTime() - 1_000),
      },
    });

    await seedActiveMatchFixture(prisma, {
      seasonId: 'season-post-match',
      activeMatchId: 'active-post-match',
      participantAId: 'participant-a',
      participantBId: 'participant-b',
      withMatchedThread: true,
    });
    await prisma.activeMatchUnmatchRequest.create({
      data: {
        activeMatchId: 'active-post-match',
        participantId: 'participant-a',
        status: 'PENDING',
        requestedAt: new Date(databaseNow.getTime() - 60_000),
      },
    });

    const sweepResult = await lifecycleSweepService.runPeriodicSweep(databaseNow);
    expect(sweepResult.matchTransitions.expiredRequests).toBeGreaterThanOrEqual(1);
    expect(sweepResult.matchTransitions.expiredUnmatchRequests).toBeGreaterThanOrEqual(1);

    const expiredRequest = await prisma.matchRequest.findUnique({
      where: { id: 'pending-request-1' },
    });
    expect(expiredRequest?.status).toBe('EXPIRED');
    expect(expiredRequest?.terminalReason).toBe('EXPIRED');

    const expiredUnmatch = await prisma.activeMatchUnmatchRequest.findFirst({
      where: {
        activeMatchId: 'active-post-match',
        participantId: 'participant-a',
      },
    });
    expect(expiredUnmatch?.status).toBe('EXPIRED_BY_CUTOFF');

    const activeMatch = await prisma.activeMatch.findUnique({
      where: { id: 'active-post-match' },
    });
    expect(activeMatch?.status).toBe('ACTIVE');
  });

  it('season history summary는 immutable history source에서 sent/received/conversation/result를 일관되게 계산한다', async () => {
    const databaseNow = await prisma.getDatabaseNow();
    const today = formatKstDate(databaseNow);

    await seedCampusDormitory();
    await seedSeason({
      id: 'season-history-summary',
      preparationStartDate: subtractDays(today, 40),
      matchingStartDate: subtractDays(today, 20),
      seasonEndDate: subtractDays(today, 1),
      roomSelectionDate: subtractDays(today, 5),
    });

    await seedRegisteredAssignedParticipant(prisma, {
      seasonId: 'season-history-summary',
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
    });
    await seedRegisteredAssignedParticipant(prisma, {
      seasonId: 'season-history-summary',
      userId: 'user-b',
      participantId: 'participant-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '유저B',
    });
    await seedRegisteredAssignedParticipant(prisma, {
      seasonId: 'season-history-summary',
      userId: 'user-c',
      participantId: 'participant-c',
      email: 'user-c@kangwon.ac.kr',
      nickname: '유저C',
    });

    await seedActiveMatchFixture(prisma, {
      seasonId: 'season-history-summary',
      activeMatchId: 'summary-active',
      participantAId: 'participant-a',
      participantBId: 'participant-b',
      withMatchedThread: true,
    });

    await prisma.conversationMessage.create({
      data: {
        threadId: 'summary-active-thread',
        senderParticipantId: 'participant-a',
        body: '시즌 종료 전 마지막 인사',
        sentAt: new Date(databaseNow.getTime() - 30_000),
      },
    });
    await prisma.conversationThread.update({
      where: { id: 'summary-active-thread' },
      data: {
        lastMessageAt: new Date(databaseNow.getTime() - 30_000),
      },
    });

    await prisma.matchRequest.create({
      data: {
        id: 'received-rejected-request',
        seasonId: 'season-history-summary',
        pairKey: 'participant-a:participant-c',
        pairMinParticipantId: 'participant-a',
        pairMaxParticipantId: 'participant-c',
        requesterParticipantId: 'participant-c',
        receiverParticipantId: 'participant-a',
        status: 'REJECTED',
        terminalReason: 'REJECTED_BY_RECEIVER',
        createdAt: new Date(databaseNow.getTime() - 120_000),
        expiresAt: new Date(databaseNow.getTime() + 300_000),
        terminalAt: new Date(databaseNow.getTime() - 60_000),
      },
    });

    const sweepResult = await lifecycleSweepService.runBoundarySweep(databaseNow);
    expect(sweepResult.matchHistory.rebuiltEntries).toBeGreaterThanOrEqual(3);

    const history = await matchesService.getMatchHistory(authContext('user-a'));
    const summary = history.items.find((item) => item.seasonId === 'season-history-summary');

    expect(summary).toMatchObject({
      finalResult: 'MATCHED_SUCCESS',
      sentRequestCount: 1,
      receivedRequestCount: 1,
    });
    expect(summary?.history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          counterpartParticipantId: 'participant-b',
          stage: 'MATCH',
          result: 'MATCHED_SUCCESS',
        }),
        expect.objectContaining({
          counterpartParticipantId: 'participant-c',
          stage: 'RECEIVED_REQUEST',
          result: 'REQUEST_REJECTED',
        }),
      ]),
    );
  });

  it('sweeper는 roomSelectionDate가 지난 direct thread를 OPEN에서 READ_ONLY로 전이한다', async () => {
    const databaseNow = await prisma.getDatabaseNow();
    const today = formatKstDate(databaseNow);

    await seedCampusDormitory();
    await seedSeason({
      id: 'season-direct-read-only',
      preparationStartDate: subtractDays(today, 30),
      matchingStartDate: subtractDays(today, 5),
      seasonEndDate: today,
      roomSelectionDate: subtractDays(today, 1),
    });
    await seedRegisteredAssignedParticipant(prisma, {
      seasonId: 'season-direct-read-only',
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
    });
    await seedRegisteredAssignedParticipant(prisma, {
      seasonId: 'season-direct-read-only',
      userId: 'user-b',
      participantId: 'participant-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '유저B',
    });
    await prisma.conversationThread.create({
      data: {
        id: 'direct-sweep-thread',
        seasonId: 'season-direct-read-only',
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
        { threadId: 'direct-sweep-thread', participantId: 'participant-a' },
        { threadId: 'direct-sweep-thread', participantId: 'participant-b' },
      ],
    });

    const sweepResult = await lifecycleSweepService.runBoundarySweep(databaseNow);
    expect(sweepResult.threadTransitions.updatedCount).toBeGreaterThanOrEqual(1);

    const thread = await prisma.conversationThread.findUnique({
      where: { id: 'direct-sweep-thread' },
    });
    expect(thread?.status).toBe('READ_ONLY');
    expect(thread?.closedReason).toBe('ROOM_SELECTION_CUTOFF');
  });

  it('override 없이도 current season read model은 DB now 기준으로 current season을 유지한다', async () => {
    const databaseNow = await prisma.getDatabaseNow();
    const today = formatKstDate(databaseNow);

    await seedCampusDormitory();
    await seedSeason({
      id: 'season-current-read-model',
      preparationStartDate: subtractDays(today, 7),
      matchingStartDate: addDays(today, 2),
      seasonEndDate: addDays(today, 20),
      roomSelectionDate: addDays(today, 18),
    });

    const context = await seasonsService.getCurrentSeasonContext('CHUNCHEON');
    expect(context).not.toBeNull();
    expect(context?.season.id).toBe('season-current-read-model');
    expect(context?.state).toBe('SEASON_OPEN');
    expect(context?.override.active).toBe(false);
    expect(context?.schedule.matchingStart).toBe(addDays(today, 2));
  });

  it('season open current season에서는 sweeper가 verified user의 season participant를 eager backfill한다', async () => {
    const databaseNow = await prisma.getDatabaseNow();
    const today = formatKstDate(databaseNow);

    await seedCampusDormitory();
    await seedSeason({
      id: 'season-open-ensure',
      preparationStartDate: subtractDays(today, 1),
      matchingStartDate: addDays(today, 7),
      seasonEndDate: addDays(today, 30),
      roomSelectionDate: addDays(today, 20),
    });

    await prisma.user.create({
      data: {
        id: 'ensure-user',
        email: 'ensure-user@kangwon.ac.kr',
        emailNormalized: 'ensure-user@kangwon.ac.kr',
        passwordHash: 'integration-password-hash',
        gender: 'M',
        campus: 'CHUNCHEON',
        emailVerifiedAt: databaseNow,
      },
    });

    const sweepResult = await lifecycleSweepService.runBoundarySweep(databaseNow);
    expect(sweepResult.participantBackfill).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          seasonId: 'season-open-ensure',
          createdCount: 1,
        }),
      ]),
    );

    const participant = await prisma.seasonParticipant.findUnique({
      where: {
        seasonId_userId: {
          seasonId: 'season-open-ensure',
          userId: 'ensure-user',
        },
      },
    });

    expect(participant).toMatchObject({
      seasonId: 'season-open-ensure',
      userId: 'ensure-user',
      participationIntent: 'UNDECIDED',
      participantStatus: 'NOT_STARTED',
    });
  });
});

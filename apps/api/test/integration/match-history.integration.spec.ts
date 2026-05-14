import { MatchesService } from '../../src/matches/matches.service.js';
import { LifecycleSweepService } from '../../src/common/lifecycle/lifecycle-sweep.service.js';
import { PrismaService } from '../../src/common/prisma/prisma.service.js';
import {
  toCompleteLifestyleColumnData,
  toLifestyleColumnData,
} from '../../src/profiles/profile-lifestyle.persistence.js';
import { createIntegrationApp } from './support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from './support/integration-db.js';
import { authContext, DEFAULT_LIFESTYLE } from './support/integration-fixtures.js';

describe('Match history integration', () => {
  jest.setTimeout(60_000);

  let prisma: PrismaService;
  let matchesService: MatchesService;
  let lifecycleSweepService: LifecycleSweepService;
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const sandbox = await createIntegrationDatabaseSandbox('match_history_integration');
    cleanupDb = sandbox.cleanup;

    const { app, prisma: prismaService } = await createIntegrationApp();
    closeApp = () => app.close();
    prisma = prismaService;
    matchesService = app.get(MatchesService);
    lifecycleSweepService = app.get(LifecycleSweepService);
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
  }

  async function seedSeason(input: {
    id: string;
    academicYear: number;
    semester: number;
    name: string;
    preparationStartDate: string;
    matchingStartDate: string;
    seasonEndDate: string;
    roomSelectionDate: string;
  }) {
    await prisma.season.create({
      data: {
        id: input.id,
        campusCode: 'CHUNCHEON',
        academicYear: input.academicYear,
        semester: input.semester,
        name: input.name,
        preparationStartDate: new Date(`${input.preparationStartDate}T00:00:00.000Z`),
        matchingStartDate: new Date(`${input.matchingStartDate}T00:00:00.000Z`),
        seasonEndDate: new Date(`${input.seasonEndDate}T00:00:00.000Z`),
      },
    });

    await prisma.seasonDormitoryOperation.create({
      data: {
        seasonId: input.id,
        dormitoryId: 'dasan',
        isOperated: true,
        roomSelectionDate: new Date(`${input.roomSelectionDate}T00:00:00.000Z`),
      },
    });
  }

  async function seedUser(input: { userId: string; email: string; nickname: string }) {
    await prisma.user.create({
      data: {
        id: input.userId,
        email: input.email,
        emailNormalized: input.email.toLowerCase(),
        passwordHash: 'integration-password-hash',
        gender: 'M',
        campus: 'CHUNCHEON',
        emailVerifiedAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    });

    await prisma.userProfile.create({
      data: {
        userId: input.userId,
        nickname: input.nickname,
        nicknameNormalized: input.nickname,
        ...toLifestyleColumnData(DEFAULT_LIFESTYLE),
        intro: `${input.nickname} 기본 소개`,
        messageToRoommate: `${input.nickname} 기본 메시지`,
      },
    });
  }

  async function seedSeasonParticipant(input: {
    seasonId: string;
    participantId: string;
    userId: string;
    nicknameSnapshot: string;
  }) {
    await prisma.seasonParticipant.create({
      data: {
        id: input.participantId,
        seasonId: input.seasonId,
        userId: input.userId,
        participationIntent: 'REGISTERED',
        registeredAt: new Date('2025-01-01T00:00:00.000Z'),
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
        participantStatus: 'ACTIVE',
        campusCodeSnapshot: 'CHUNCHEON',
        genderSnapshot: 'M',
        joinedAt: new Date('2025-01-01T00:00:00.000Z'),
        activatedAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    });

    await prisma.seasonParticipantProfile.create({
      data: {
        participantId: input.participantId,
        nicknameSnapshot: input.nicknameSnapshot,
        nicknameNormalizedSnapshot: input.nicknameSnapshot,
        ...toCompleteLifestyleColumnData(DEFAULT_LIFESTYLE),
        intro: `${input.nicknameSnapshot} 시즌 소개`,
        messageToRoommate: `${input.nicknameSnapshot} 시즌 메시지`,
      },
    });
  }

  it('OFF_SEASON에서도 current-season 요청은 비어 있고, past-season history는 여러 종료 시즌의 요약/행동 카드를 반환한다', async () => {
    await seedCampusDormitory();

    await seedSeason({
      id: 'season-2025-02',
      academicYear: 2025,
      semester: 2,
      name: '2025-02',
      preparationStartDate: '2025-07-01',
      matchingStartDate: '2025-07-10',
      seasonEndDate: '2025-08-31',
      roomSelectionDate: '2025-08-20',
    });
    await seedSeason({
      id: 'season-2025-01',
      academicYear: 2025,
      semester: 1,
      name: '2025-01',
      preparationStartDate: '2025-01-01',
      matchingStartDate: '2025-01-10',
      seasonEndDate: '2025-02-28',
      roomSelectionDate: '2025-02-20',
    });

    await seedUser({ userId: 'user-a', email: 'user-a@kangwon.ac.kr', nickname: '홍길동' });
    await seedUser({ userId: 'user-b', email: 'user-b@kangwon.ac.kr', nickname: '여름노래' });
    await seedUser({ userId: 'user-c', email: 'user-c@kangwon.ac.kr', nickname: '겨울이야기' });
    await seedUser({ userId: 'user-d', email: 'user-d@kangwon.ac.kr', nickname: '좋은날씨' });
    await seedUser({ userId: 'user-e', email: 'user-e@kangwon.ac.kr', nickname: '가을바람' });

    await seedSeasonParticipant({
      seasonId: 'season-2025-02',
      participantId: 'participant-a-2025-02',
      userId: 'user-a',
      nicknameSnapshot: '홍길동-2025-02',
    });
    await seedSeasonParticipant({
      seasonId: 'season-2025-02',
      participantId: 'participant-b-2025-02',
      userId: 'user-b',
      nicknameSnapshot: '여름노래',
    });
    await seedSeasonParticipant({
      seasonId: 'season-2025-02',
      participantId: 'participant-c-2025-02',
      userId: 'user-c',
      nicknameSnapshot: '겨울이야기',
    });
    await seedSeasonParticipant({
      seasonId: 'season-2025-02',
      participantId: 'participant-d-2025-02',
      userId: 'user-d',
      nicknameSnapshot: '좋은날씨',
    });

    await seedSeasonParticipant({
      seasonId: 'season-2025-01',
      participantId: 'participant-a-2025-01',
      userId: 'user-a',
      nicknameSnapshot: '홍길동-2025-01',
    });
    await seedSeasonParticipant({
      seasonId: 'season-2025-01',
      participantId: 'participant-e-2025-01',
      userId: 'user-e',
      nicknameSnapshot: '가을바람',
    });

    await prisma.matchRequest.create({
      data: {
        id: 'request-cancelled-a-b',
        seasonId: 'season-2025-02',
        pairKey: 'participant-a-2025-02:participant-b-2025-02',
        pairMinParticipantId: 'participant-a-2025-02',
        pairMaxParticipantId: 'participant-b-2025-02',
        requesterParticipantId: 'participant-a-2025-02',
        receiverParticipantId: 'participant-b-2025-02',
        status: 'CANCELLED_BY_REQUESTER',
        terminalReason: 'CANCELLED_BY_REQUESTER',
        createdAt: new Date('2025-07-22T12:00:00.000Z'),
        expiresAt: new Date('2025-07-27T12:00:00.000Z'),
        terminalAt: new Date('2025-07-22T13:00:00.000Z'),
        requestChannel: 'PROFILE_DETAIL',
      },
    });
    await prisma.matchRequest.create({
      data: {
        id: 'request-rejected-c-a',
        seasonId: 'season-2025-02',
        pairKey: 'participant-a-2025-02:participant-c-2025-02',
        pairMinParticipantId: 'participant-a-2025-02',
        pairMaxParticipantId: 'participant-c-2025-02',
        requesterParticipantId: 'participant-c-2025-02',
        receiverParticipantId: 'participant-a-2025-02',
        status: 'REJECTED',
        terminalReason: 'REJECTED_BY_RECEIVER',
        createdAt: new Date('2025-07-26T12:00:00.000Z'),
        expiresAt: new Date('2025-07-31T12:00:00.000Z'),
        terminalAt: new Date('2025-07-26T15:00:00.000Z'),
        requestChannel: 'PROFILE_DETAIL',
      },
    });
    await prisma.matchRequest.create({
      data: {
        id: 'request-accepted-a-d',
        seasonId: 'season-2025-02',
        pairKey: 'participant-a-2025-02:participant-d-2025-02',
        pairMinParticipantId: 'participant-a-2025-02',
        pairMaxParticipantId: 'participant-d-2025-02',
        requesterParticipantId: 'participant-a-2025-02',
        receiverParticipantId: 'participant-d-2025-02',
        status: 'ACCEPTED',
        terminalReason: 'ACCEPTED',
        createdAt: new Date('2025-08-01T09:00:00.000Z'),
        expiresAt: new Date('2025-08-06T09:00:00.000Z'),
        terminalAt: new Date('2025-08-01T10:00:00.000Z'),
        acceptedAt: new Date('2025-08-01T10:00:00.000Z'),
        requestChannel: 'PROFILE_DETAIL',
      },
    });
    await prisma.activeMatch.create({
      data: {
        id: 'active-unmatched-a-d',
        seasonId: 'season-2025-02',
        pairKey: 'participant-a-2025-02:participant-d-2025-02',
        participantAId: 'participant-a-2025-02',
        participantBId: 'participant-d-2025-02',
        createdFromRequestId: 'request-accepted-a-d',
        status: 'UNMATCHED',
        startedAt: new Date('2025-08-01T10:00:00.000Z'),
        endedAt: new Date('2025-08-01T18:00:00.000Z'),
        endReason: 'UNMATCHED_BY_MUTUAL_CONSENT',
      },
    });
    await prisma.conversationThread.create({
      data: {
        id: 'thread-a-d-2026-02',
        seasonId: 'season-2025-02',
        pairKey: 'participant-a-2025-02:participant-d-2025-02',
        participantAId: 'participant-a-2025-02',
        participantBId: 'participant-d-2025-02',
        openedByParticipantId: 'participant-a-2025-02',
        threadKind: 'DIRECT',
        activeMatchId: null,
        status: 'READ_ONLY',
        closedReason: 'ROOM_SELECTION_CUTOFF',
        closedAt: new Date('2025-08-20T15:00:00.000Z'),
        lastMessageAt: new Date('2025-08-01T11:00:00.000Z'),
      },
    });
    await prisma.conversationThreadMember.createMany({
      data: [
        {
          threadId: 'thread-a-d-2026-02',
          participantId: 'participant-a-2025-02',
        },
        {
          threadId: 'thread-a-d-2026-02',
          participantId: 'participant-d-2025-02',
        },
      ],
    });
    await prisma.conversationMessage.create({
      data: {
        id: 'message-a-d-2026-02',
        threadId: 'thread-a-d-2026-02',
        senderParticipantId: 'participant-a-2025-02',
        body: '매칭 직후 인사',
        sentAt: new Date('2025-08-01T11:00:00.000Z'),
      },
    });

    await prisma.matchRequest.create({
      data: {
        id: 'request-accepted-a-e',
        seasonId: 'season-2025-01',
        pairKey: 'participant-a-2025-01:participant-e-2025-01',
        pairMinParticipantId: 'participant-a-2025-01',
        pairMaxParticipantId: 'participant-e-2025-01',
        requesterParticipantId: 'participant-a-2025-01',
        receiverParticipantId: 'participant-e-2025-01',
        status: 'ACCEPTED',
        terminalReason: 'ACCEPTED',
        createdAt: new Date('2025-02-10T09:00:00.000Z'),
        expiresAt: new Date('2025-02-15T09:00:00.000Z'),
        terminalAt: new Date('2025-02-10T10:00:00.000Z'),
        acceptedAt: new Date('2025-02-10T10:00:00.000Z'),
        requestChannel: 'PROFILE_DETAIL',
      },
    });
    await prisma.activeMatch.create({
      data: {
        id: 'active-success-a-e',
        seasonId: 'season-2025-01',
        pairKey: 'participant-a-2025-01:participant-e-2025-01',
        participantAId: 'participant-a-2025-01',
        participantBId: 'participant-e-2025-01',
        createdFromRequestId: 'request-accepted-a-e',
        status: 'SEASON_ENDED',
        startedAt: new Date('2025-02-10T10:00:00.000Z'),
        endedAt: new Date('2025-03-01T00:00:00.000Z'),
        endReason: 'SEASON_ENDED',
      },
    });
    await prisma.conversationThread.create({
      data: {
        id: 'thread-a-e-2026-01',
        seasonId: 'season-2025-01',
        pairKey: 'participant-a-2025-01:participant-e-2025-01',
        participantAId: 'participant-a-2025-01',
        participantBId: 'participant-e-2025-01',
        openedByParticipantId: 'participant-a-2025-01',
        threadKind: 'MATCHED',
        activeMatchId: 'active-success-a-e',
        status: 'READ_ONLY',
        closedReason: 'SEASON_ENDED',
        closedAt: new Date('2025-03-01T00:00:00.000Z'),
        lastMessageAt: new Date('2025-02-10T11:00:00.000Z'),
      },
    });
    await prisma.conversationThreadMember.createMany({
      data: [
        {
          threadId: 'thread-a-e-2026-01',
          participantId: 'participant-a-2025-01',
        },
        {
          threadId: 'thread-a-e-2026-01',
          participantId: 'participant-e-2025-01',
        },
      ],
    });

    const now = new Date('2026-05-10T00:00:00.000Z');
    const sweepResult = await lifecycleSweepService.runBoundarySweep(now);
    expect(sweepResult.matchHistory.rebuiltEntries).toBeGreaterThanOrEqual(5);

    const currentRequests = await matchesService.listCurrentSeasonRequests(authContext('user-a'));
    expect(currentRequests.items).toEqual([]);

    const currentActiveMatch = await matchesService.getCurrentActiveMatch(authContext('user-a'));
    expect(currentActiveMatch).toEqual({ activeMatch: null });

    const history = await matchesService.getMatchHistory(authContext('user-a'));
    expect(history.items).toHaveLength(2);

    expect(history.items[0]).toMatchObject({
      seasonId: 'season-2025-02',
      seasonName: '2025-02',
      finalResult: 'UNMATCHED_AFTER_SUCCESS',
      sentRequestCount: 2,
      receivedRequestCount: 1,
      conversationCount: 1,
    });
    expect(history.items[0]?.history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          counterpartNickname: '여름노래',
          stage: 'SENT_REQUEST',
          result: 'REQUEST_CANCELLED',
          finalizedAt: '2025-07-22T13:00:00.000Z',
        }),
        expect.objectContaining({
          counterpartNickname: '겨울이야기',
          stage: 'RECEIVED_REQUEST',
          result: 'REQUEST_REJECTED',
          finalizedAt: '2025-07-26T15:00:00.000Z',
        }),
        expect.objectContaining({
          counterpartNickname: '좋은날씨',
          stage: 'MATCH',
          result: 'UNMATCHED_AFTER_SUCCESS',
          matchedAt: '2025-08-01T10:00:00.000Z',
          unmatchedAt: '2025-08-01T18:00:00.000Z',
          hadConversation: true,
        }),
      ]),
    );

    expect(history.items[1]).toMatchObject({
      seasonId: 'season-2025-01',
      seasonName: '2025-01',
      finalResult: 'MATCHED_SUCCESS',
      sentRequestCount: 1,
      receivedRequestCount: 0,
      conversationCount: 1,
    });
  });

  it('history row에는 viewer 기준 match score snapshot을 저장하고 user DTO에는 숨긴다', async () => {
    await seedCampusDormitory();
    await seedSeason({
      id: 'season-2025-01',
      academicYear: 2025,
      semester: 1,
      name: '2025-01',
      preparationStartDate: '2025-01-01',
      matchingStartDate: '2025-01-10',
      seasonEndDate: '2025-02-28',
      roomSelectionDate: '2025-02-20',
    });

    await seedUser({ userId: 'user-a', email: 'user-a@kangwon.ac.kr', nickname: '홍길동' });
    await seedUser({ userId: 'user-b', email: 'user-b@kangwon.ac.kr', nickname: '좋은날씨' });
    await seedSeasonParticipant({
      seasonId: 'season-2025-01',
      participantId: 'participant-a-2025-01',
      userId: 'user-a',
      nicknameSnapshot: '홍길동-2025-01',
    });
    await seedSeasonParticipant({
      seasonId: 'season-2025-01',
      participantId: 'participant-b-2025-01',
      userId: 'user-b',
      nicknameSnapshot: '좋은날씨',
    });

    await prisma.seasonParticipantProfile.update({
      where: { participantId: 'participant-a-2025-01' },
      data: {
        ...toCompleteLifestyleColumnData({
          ...DEFAULT_LIFESTYLE,
          cleanExpectation: 'STRICT',
        }),
      },
    });
    await prisma.seasonParticipantProfile.update({
      where: { participantId: 'participant-b-2025-01' },
      data: {
        ...toCompleteLifestyleColumnData({
          ...DEFAULT_LIFESTYLE,
          cleanLevel: 'WHEN_DIRTY',
        }),
      },
    });

    await prisma.matchRequest.create({
      data: {
        id: 'request-a-b-accepted',
        seasonId: 'season-2025-01',
        pairKey: 'participant-a-2025-01:participant-b-2025-01',
        pairMinParticipantId: 'participant-a-2025-01',
        pairMaxParticipantId: 'participant-b-2025-01',
        requesterParticipantId: 'participant-a-2025-01',
        receiverParticipantId: 'participant-b-2025-01',
        status: 'ACCEPTED',
        terminalReason: 'ACCEPTED',
        createdAt: new Date('2025-01-20T10:00:00.000Z'),
        expiresAt: new Date('2025-01-25T10:00:00.000Z'),
        terminalAt: new Date('2025-01-20T12:00:00.000Z'),
        acceptedAt: new Date('2025-01-20T12:00:00.000Z'),
        requestChannel: 'PROFILE_DETAIL',
      },
    });
    await prisma.activeMatch.create({
      data: {
        id: 'active-a-b',
        seasonId: 'season-2025-01',
        pairKey: 'participant-a-2025-01:participant-b-2025-01',
        participantAId: 'participant-a-2025-01',
        participantBId: 'participant-b-2025-01',
        createdFromRequestId: 'request-a-b-accepted',
        status: 'SEASON_ENDED',
        startedAt: new Date('2025-01-20T12:00:00.000Z'),
        endedAt: new Date('2025-03-01T00:00:00.000Z'),
        endReason: 'SEASON_ENDED',
      },
    });

    const history = await matchesService.getMatchHistory(authContext('user-a'));
    const storedRow = await prisma.seasonMatchHistoryEntry.findFirst({
      where: {
        seasonId: 'season-2025-01',
        viewerParticipantId: 'participant-a-2025-01',
        counterpartParticipantId: 'participant-b-2025-01',
        entryType: 'MATCH',
      },
    });

    expect(storedRow).toMatchObject({
      viewerCleanExpectationSnapshot: 'STRICT',
      viewerBedtimeSnapshot: 'BETWEEN_22_24',
      viewerWakeTimeSnapshot: 'BETWEEN_07_08',
      viewerRelationshipStyleSnapshot: 'CLOSE',
      viewerTemperatureSensitivitySnapshot: 'NORMAL',
      counterpartCleanLevelSnapshot: 'WHEN_DIRTY',
    });
    expect(storedRow?.matchScore).not.toBeNull();

    expect(history.items[0]?.history[0]).not.toHaveProperty('matchScore');
  });

  it('terminal request row도 viewer 기준 score snapshot을 저장하고 user DTO에는 숨긴다', async () => {
    await seedCampusDormitory();
    await seedSeason({
      id: 'season-request-snapshot',
      academicYear: 2025,
      semester: 1,
      name: '2025-request-snapshot',
      preparationStartDate: '2025-01-01',
      matchingStartDate: '2025-01-10',
      seasonEndDate: '2025-02-28',
      roomSelectionDate: '2025-02-20',
    });

    await seedUser({ userId: 'user-a', email: 'user-a@kangwon.ac.kr', nickname: '홍길동' });
    await seedUser({ userId: 'user-b', email: 'user-b@kangwon.ac.kr', nickname: '좋은날씨' });
    await seedSeasonParticipant({
      seasonId: 'season-request-snapshot',
      participantId: 'participant-a-request',
      userId: 'user-a',
      nicknameSnapshot: '홍길동-request',
    });
    await seedSeasonParticipant({
      seasonId: 'season-request-snapshot',
      participantId: 'participant-b-request',
      userId: 'user-b',
      nicknameSnapshot: '좋은날씨',
    });

    await prisma.seasonParticipantProfile.update({
      where: { participantId: 'participant-a-request' },
      data: {
        ...toCompleteLifestyleColumnData({
          ...DEFAULT_LIFESTYLE,
          cleanExpectation: 'STRICT',
        }),
      },
    });
    await prisma.seasonParticipantProfile.update({
      where: { participantId: 'participant-b-request' },
      data: {
        ...toCompleteLifestyleColumnData({
          ...DEFAULT_LIFESTYLE,
          cleanLevel: 'WHEN_DIRTY',
        }),
      },
    });

    await prisma.matchRequest.create({
      data: {
        id: 'request-only-terminal',
        seasonId: 'season-request-snapshot',
        pairKey: 'participant-a-request:participant-b-request',
        pairMinParticipantId: 'participant-a-request',
        pairMaxParticipantId: 'participant-b-request',
        requesterParticipantId: 'participant-a-request',
        receiverParticipantId: 'participant-b-request',
        status: 'REJECTED',
        terminalReason: 'REJECTED_BY_RECEIVER',
        createdAt: new Date('2025-01-20T10:00:00.000Z'),
        expiresAt: new Date('2025-01-25T10:00:00.000Z'),
        terminalAt: new Date('2025-01-20T12:00:00.000Z'),
        requestChannel: 'PROFILE_DETAIL',
      },
    });

    const history = await matchesService.getMatchHistory(authContext('user-a'));
    const storedRow = await prisma.seasonMatchHistoryEntry.findFirst({
      where: {
        seasonId: 'season-request-snapshot',
        viewerParticipantId: 'participant-a-request',
        counterpartParticipantId: 'participant-b-request',
        entryType: 'REQUEST',
      },
    });

    expect(storedRow?.matchScore).toEqual(expect.any(Number));
    expect(storedRow).toMatchObject({
      viewerCleanExpectationSnapshot: 'STRICT',
      viewerBedtimeSnapshot: 'BETWEEN_22_24',
      viewerWakeTimeSnapshot: 'BETWEEN_07_08',
      viewerRelationshipStyleSnapshot: 'CLOSE',
      viewerTemperatureSensitivitySnapshot: 'NORMAL',
      counterpartCleanLevelSnapshot: 'WHEN_DIRTY',
      requestTerminalReason: 'REJECTED_BY_RECEIVER',
    });

    const requestHistory = history.items[0]?.history.find((row) => row.id === storedRow?.id);
    expect(requestHistory).toBeDefined();
    expect(requestHistory).not.toHaveProperty('matchScore');
  });
});

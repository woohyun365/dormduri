import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AuthLoginAttemptService } from '../../../src/auth/login-attempts/account-lock/auth-login-attempt.service.js';
import { ChatService } from '../../../src/chat/application/chat.service.js';
import { PrismaService } from '../../../src/platform/database/prisma.service.js';
import { MatchesService } from '../../../src/matches/application/matches.service.js';
import { SeasonParticipantsService } from '../../../src/season-participants/application/season-participants.service.js';
import { createIntegrationApp } from '../_support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from '../_support/integration-db.js';
import {
  authContext,
  seedActiveMatchFixture,
  seedBaseSeasonFixtures,
  seedRegisteredAssignedParticipant,
} from '../_support/integration-fixtures.js';

function waitMs(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('timestamp field integration', () => {
  let prisma: PrismaService;
  let loginAttemptService: AuthLoginAttemptService;
  let seasonParticipantsService: SeasonParticipantsService;
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
    seasonParticipantsService = app.get(SeasonParticipantsService);
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

  it('Prisma mutation은 User.updatedAt을 갱신한다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저가',
    });

    const before = await prisma.user.findUniqueOrThrow({ where: { id: 'user-a' } });
    await waitMs(10);
    await prisma.user.update({
      where: { id: 'user-a' },
      data: {
        email: 'prisma-update@kangwon.ac.kr',
      },
    });
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
      nickname: '유저가',
    });
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-b',
      participantId: 'participant-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '유저나',
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

    await seasonParticipantsService.createOrUpdateDormitorySelection('user-a', {
      dormitoryId: 'dasan',
    });
    await seasonParticipantsService.finalizeSeasonRegistration('user-a');

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
      clientMessageId: 'client-message-timestamp-check',
    });
    const thread = await prisma.conversationThread.findFirstOrThrow({
      where: { pairKey: 'participant-a:participant-b' },
    });
    expect(thread.lastMessageAt).not.toBeNull();
  });

  it('DB trigger가 없는 mutable model들도 Prisma @updatedAt으로 updatedAt을 갱신한다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저가',
    });
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-b',
      participantId: 'participant-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '유저나',
    });
    await seedActiveMatchFixture(prisma, {
      activeMatchId: 'active-updated-at',
      participantAId: 'participant-a',
      participantBId: 'participant-b',
      withMatchedThread: true,
    });

    await prisma.activeMatchUnmatchRequest.create({
      data: {
        id: 'unmatch-updated-at',
        activeMatchId: 'active-updated-at',
        participantId: 'participant-a',
        status: 'PENDING',
      },
    });
    await prisma.seasonMatchHistoryEntry.create({
      data: {
        id: 'history-updated-at',
        seasonId: 'season-integration',
        viewerParticipantId: 'participant-a',
        counterpartParticipantId: 'participant-b',
        pairKey: 'participant-a:participant-b',
        entryType: 'MATCH',
        entryResult: 'MATCHED_SUCCESS',
        viewerRequested: true,
        counterpartNicknameSnapshot: '유저나',
        matchedAt: new Date(),
        finalizedAt: new Date(),
        requestTerminalReason: 'ACCEPTED',
        activeMatchEndReason: 'SEASON_ENDED',
      },
    });

    const before = {
      userDisplayIdentity: await prisma.userDisplayIdentity.findUniqueOrThrow({
        where: { userId: 'user-a' },
      }),
      seasonParticipant: await prisma.seasonParticipant.findUniqueOrThrow({
        where: { id: 'participant-a' },
      }),
      seasonParticipantProfile: await prisma.seasonParticipantProfile.findUniqueOrThrow({
        where: { participantId: 'participant-a' },
      }),
      activeMatch: await prisma.activeMatch.findUniqueOrThrow({
        where: { id: 'active-updated-at' },
      }),
      activeMatchUnmatchRequest: await prisma.activeMatchUnmatchRequest.findUniqueOrThrow({
        where: { id: 'unmatch-updated-at' },
      }),
      conversationThread: await prisma.conversationThread.findUniqueOrThrow({
        where: { id: 'active-updated-at-thread' },
      }),
      conversationThreadMember: await prisma.conversationThreadMember.findUniqueOrThrow({
        where: {
          threadId_participantId: {
            threadId: 'active-updated-at-thread',
            participantId: 'participant-a',
          },
        },
      }),
      seasonMatchHistoryEntry: await prisma.seasonMatchHistoryEntry.findUniqueOrThrow({
        where: { id: 'history-updated-at' },
      }),
    };

    await waitMs(10);

    await prisma.userDisplayIdentity.update({
      where: { userId: 'user-a' },
      data: { nickname: '변경닉네임' },
    });
    await prisma.seasonParticipant.updateMany({
      where: { id: 'participant-a' },
      data: {
        hiddenReasonCode: 'OTHER',
        hiddenReasonDetail: 'updated by test',
      },
    });
    await prisma.seasonParticipantProfile.update({
      where: { participantId: 'participant-a' },
      data: { intro: 'updated season intro' },
    });
    await prisma.activeMatch.update({
      where: { id: 'active-updated-at' },
      data: {
        status: 'ADMIN_ENDED',
        endedAt: new Date(),
        endReason: 'ADMIN_ACTION',
      },
    });
    await prisma.activeMatchUnmatchRequest.updateMany({
      where: { id: 'unmatch-updated-at' },
      data: {
        status: 'CANCELLED_BY_REQUESTER',
        terminalAt: new Date(),
      },
    });
    await prisma.conversationThread.update({
      where: { id: 'active-updated-at-thread' },
      data: {
        status: 'READ_ONLY',
        closedReason: 'SEASON_ENDED',
        closedAt: new Date(),
      },
    });
    await prisma.conversationThreadMember.updateMany({
      where: {
        threadId: 'active-updated-at-thread',
        participantId: 'participant-a',
      },
      data: {
        memberState: 'LEFT',
        leftAt: new Date(),
      },
    });
    await prisma.seasonMatchHistoryEntry.updateMany({
      where: { id: 'history-updated-at' },
      data: { viewerDormitoryIdSnapshot: 'dasan' },
    });

    const after = {
      userDisplayIdentity: await prisma.userDisplayIdentity.findUniqueOrThrow({
        where: { userId: 'user-a' },
      }),
      seasonParticipant: await prisma.seasonParticipant.findUniqueOrThrow({
        where: { id: 'participant-a' },
      }),
      seasonParticipantProfile: await prisma.seasonParticipantProfile.findUniqueOrThrow({
        where: { participantId: 'participant-a' },
      }),
      activeMatch: await prisma.activeMatch.findUniqueOrThrow({
        where: { id: 'active-updated-at' },
      }),
      activeMatchUnmatchRequest: await prisma.activeMatchUnmatchRequest.findUniqueOrThrow({
        where: { id: 'unmatch-updated-at' },
      }),
      conversationThread: await prisma.conversationThread.findUniqueOrThrow({
        where: { id: 'active-updated-at-thread' },
      }),
      conversationThreadMember: await prisma.conversationThreadMember.findUniqueOrThrow({
        where: {
          threadId_participantId: {
            threadId: 'active-updated-at-thread',
            participantId: 'participant-a',
          },
        },
      }),
      seasonMatchHistoryEntry: await prisma.seasonMatchHistoryEntry.findUniqueOrThrow({
        where: { id: 'history-updated-at' },
      }),
    };

    expect(after.userDisplayIdentity.updatedAt.getTime()).toBeGreaterThan(
      before.userDisplayIdentity.updatedAt.getTime(),
    );
    expect(after.seasonParticipant.updatedAt.getTime()).toBeGreaterThan(
      before.seasonParticipant.updatedAt.getTime(),
    );
    expect(after.seasonParticipantProfile.updatedAt.getTime()).toBeGreaterThan(
      before.seasonParticipantProfile.updatedAt.getTime(),
    );
    expect(after.activeMatch.updatedAt.getTime()).toBeGreaterThan(
      before.activeMatch.updatedAt.getTime(),
    );
    expect(after.activeMatchUnmatchRequest.updatedAt.getTime()).toBeGreaterThan(
      before.activeMatchUnmatchRequest.updatedAt.getTime(),
    );
    expect(after.conversationThread.updatedAt.getTime()).toBeGreaterThan(
      before.conversationThread.updatedAt.getTime(),
    );
    expect(after.conversationThreadMember.updatedAt.getTime()).toBeGreaterThan(
      before.conversationThreadMember.updatedAt.getTime(),
    );
    expect(after.seasonMatchHistoryEntry.updatedAt.getTime()).toBeGreaterThan(
      before.seasonMatchHistoryEntry.updatedAt.getTime(),
    );
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { AuthSessionService } from '../../../src/auth/sessions/auth-session.service.js';
import { hashPassword } from '../../../src/auth/application/auth-password-hash.js';
import { LifecycleSweepService } from '../../../src/lifecycle/lifecycle-sweep.service.js';
import { PrismaService } from '../../../src/platform/database/prisma.service.js';
import { createIntegrationApp } from '../_support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from '../_support/integration-db.js';
import {
  toCompleteLifestyleColumnData,
  DEFAULT_LIFESTYLE,
  seedActiveMatchFixture,
  seedBaseSeasonFixtures,
} from '../_support/integration-fixtures.js';

describe('account deletion + season de-registration integration', () => {
  const retainedVaultEnv = {
    RETENTION_IDENTITY_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 20).toString('base64'),
    RETENTION_IDENTITY_KEY_VERSION: 'account-deletion-identity-v1',
    RETENTION_VAULT_NICKNAME_AUDIT_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 21).toString('base64'),
    RETENTION_VAULT_NICKNAME_AUDIT_KEY_VERSION: 'account-deletion-nickname-v1',
    RETENTION_VAULT_ACADEMIC_IDENTITY_AUDIT_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 25).toString(
      'base64',
    ),
    RETENTION_VAULT_ACADEMIC_IDENTITY_AUDIT_KEY_VERSION: 'account-deletion-academic-v1',
    RETENTION_VAULT_SEASON_PROFILE_HISTORY_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 22).toString(
      'base64',
    ),
    RETENTION_VAULT_SEASON_PROFILE_HISTORY_KEY_VERSION: 'account-deletion-profile-v1',
    RETENTION_VAULT_MATCH_HISTORY_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 23).toString('base64'),
    RETENTION_VAULT_MATCH_HISTORY_KEY_VERSION: 'account-deletion-match-v1',
    RETENTION_VAULT_CHAT_BODY_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 24).toString('base64'),
    RETENTION_VAULT_CHAT_BODY_KEY_VERSION: 'account-deletion-chat-v1',
  } as const;
  let previousRetainedVaultEnv: Partial<Record<keyof typeof retainedVaultEnv, string | undefined>>;
  let prisma: PrismaService;
  let authSessionService: AuthSessionService;
  let lifecycleSweepService: LifecycleSweepService;
  let httpServer: Parameters<typeof request>[0];
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    previousRetainedVaultEnv = Object.fromEntries(
      Object.keys(retainedVaultEnv).map((key) => [
        key,
        process.env[key as keyof typeof retainedVaultEnv],
      ]),
    );
    Object.assign(process.env, retainedVaultEnv);

    const sandbox = await createIntegrationDatabaseSandbox('account_deletion_integration');
    cleanupDb = sandbox.cleanup;

    const { app, prisma: prismaService } = await createIntegrationApp();
    closeApp = () => app.close();
    prisma = prismaService;
    authSessionService = app.get(AuthSessionService);
    lifecycleSweepService = app.get(LifecycleSweepService);
    httpServer = app.getHttpServer() as Parameters<typeof request>[0];
  });

  afterAll(async () => {
    if (closeApp) {
      await closeApp();
    }
    if (cleanupDb) {
      await cleanupDb();
    }
    for (const key of Object.keys(retainedVaultEnv) as Array<keyof typeof retainedVaultEnv>) {
      const previous = previousRetainedVaultEnv[key];
      if (previous === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous;
      }
    }
  });

  beforeEach(async () => {
    await truncateIntegrationSchema(prisma);
    await seedBaseSeasonFixtures(prisma);
  });

  async function seedVerifiedUser(input: {
    userId: string;
    email: string;
    nickname: string;
    withParticipant?: boolean;
  }) {
    const now = await prisma.getDatabaseNow();
    const passwordHash = await hashPassword('Pass1234');

    await prisma.user.create({
      data: {
        id: input.userId,
        email: input.email,
        emailNormalized: input.email.toLowerCase(),
        passwordHash,
        gender: 'M',
        campus: 'CHUNCHEON',
        emailVerifiedAt: new Date(now.getTime() - 24 * 60 * 60 * 1_000),
      },
    });

    await prisma.userDisplayIdentity.create({
      data: {
        userId: input.userId,
        nickname: input.nickname,
        nicknameNormalized: input.nickname,
      },
    });
    await prisma.userAcademicIdentity.create({
      data: {
        userId: input.userId,
        collegeCode: 'CHUNCHEON_ARTS_ENGINEERING',
        birthYear: 2002,
      },
    });

    if (input.withParticipant) {
      const registeredAt = new Date(now.getTime() - 24 * 60 * 60 * 1_000);

      await prisma.seasonParticipant.create({
        data: {
          id: `${input.userId}-participant`,
          seasonId: 'season-integration',
          userId: input.userId,
          participationIntent: 'REGISTERED',
          registeredAt,
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
          participantStatus: 'ACTIVE',
          campusCodeSnapshot: 'CHUNCHEON',
          genderSnapshot: 'M',
          joinedAt: now,
          activatedAt: now,
        },
      });

      await prisma.seasonParticipantProfile.create({
        data: {
          participantId: `${input.userId}-participant`,
          nicknameSnapshot: input.nickname,
          nicknameNormalizedSnapshot: input.nickname,
          bedtime: 'BETWEEN_22_24',
          wakeTime: 'BETWEEN_07_08',
          sleepHabit: 'NONE',
          sleepEnvironment: 'QUIET',
          screenUsage: 'NONE',
          noiseSensitivity: 'NORMAL',
          smokingBehavior: 'NO',
          indoorEating: 'SNACK',
          phoneBehavior: 'SOMETIMES',
          earphoneUsage: 'MOSTLY',
          cleanLevel: 'WEEKLY_3_UP',
          drinkingFrequency: 'NONE',
          relationshipStyle: 'CLOSE',
          temperatureSensitivity: 'NORMAL',
          smokingTolerance: 'NO_ONLY',
          phoneTolerance: 'BRIEF_OK',
          earphoneExpectation: 'MUST',
          sleepEnvPreference: 'NO_SPEAKER',
          screenTolerance: 'LOW_OK',
          indoorEatingTolerance: 'NO_SMELL',
          cleanExpectation: 'STRICT',
          drinkingTolerance: 'LOW_ONLY',
          intro: `${input.nickname} 시즌 소개`,
        },
      });

      await prisma.seasonParticipantProfileHistory.create({
        data: {
          participantId: `${input.userId}-participant`,
          seasonId: 'season-integration',
          source: 'SEASON_REGISTRATION',
          nicknameSnapshot: input.nickname,
          nicknameNormalizedSnapshot: input.nickname,
          ...toCompleteLifestyleColumnData(DEFAULT_LIFESTYLE),
          intro: `${input.nickname} 시즌 소개`,
          registeredAtSnapshot: registeredAt,
        },
      });
    }
  }

  async function issueAccessToken(userId: string, email: string) {
    const issued = await authSessionService.issueAuthResult(userId, email, false);
    return issued.accessToken;
  }

  async function seedRegistrationReadyDraftUser(input: {
    userId: string;
    email: string;
    nickname: string;
    participantId: string;
  }) {
    const now = await prisma.getDatabaseNow();
    await seedVerifiedUser({
      userId: input.userId,
      email: input.email,
      nickname: input.nickname,
    });
    await prisma.seasonParticipant.create({
      data: {
        id: input.participantId,
        seasonId: 'season-integration',
        userId: input.userId,
        participationIntent: 'UNDECIDED',
        dormitoryId: 'dasan',
        dormitorySelectionState: 'SELECTED',
        participantStatus: 'DRAFT',
        campusCodeSnapshot: 'CHUNCHEON',
        genderSnapshot: 'M',
        joinedAt: now,
      },
    });
    await prisma.seasonParticipantProfile.create({
      data: {
        participantId: input.participantId,
        nicknameSnapshot: input.nickname,
        nicknameNormalizedSnapshot: input.nickname,
        ...toCompleteLifestyleColumnData(DEFAULT_LIFESTYLE),
        intro: `${input.nickname} 등록 준비 소개`,
        collegeCode: 'CHUNCHEON_ARTS_ENGINEERING',
        grade: '3',
        mbti: 'INTJ',
        birthYear: 2002,
      },
    });
  }

  it('current season registered participant는 계정 삭제 요청 대신 시즌 참여 철회 또는 시즌 종료 후 재시도를 안내받는다', async () => {
    await seedVerifiedUser({
      userId: 'user-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
      withParticipant: true,
    });
    const accessToken = await issueAccessToken('user-a', 'user-a@kangwon.ac.kr');

    const response = await request(httpServer)
      .post('/api/users/me/delete')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ password: 'Pass1234' })
      .expect(409);

    const body = response.body as { code: string; seasonState: string };
    expect(body.code).toBe('ACCOUNT_DELETION_BLOCKED_BY_SEASON_PARTICIPATION');
    expect(body.seasonState).toBe('SEASON_MATCHING');
  });

  it('계정 삭제와 registration finalize가 동시에 실행되어도 삭제 계정과 등록 완료 participant가 동시에 남지 않는다', async () => {
    const userId = 'delete-register-race-user';
    const participantId = 'delete-register-race-participant';
    const email = 'delete-register-race@kangwon.ac.kr';
    await seedRegistrationReadyDraftUser({
      userId,
      participantId,
      email,
      nickname: '삭제등록경합',
    });
    const accessToken = await issueAccessToken(userId, email);

    const [deleteResponse, registrationResponse] = await Promise.all([
      request(httpServer)
        .post('/api/users/me/delete')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ password: 'Pass1234' }),
      request(httpServer)
        .post('/api/seasons/current/participation/registration')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({}),
    ]);

    const deletionSucceeded = deleteResponse.status === 201;
    const registrationSucceeded = registrationResponse.status === 201;
    expect(Number(deletionSucceeded) + Number(registrationSucceeded)).toBe(1);

    const [user, participant, historyCount] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      prisma.seasonParticipant.findUniqueOrThrow({ where: { id: participantId } }),
      prisma.seasonParticipantProfileHistory.count({
        where: { participantId, source: 'SEASON_REGISTRATION' },
      }),
    ]);
    const registrationComplete =
      participant.participationIntent === 'REGISTERED' &&
      participant.registeredAt !== null &&
      participant.dormitorySelectionState === 'ASSIGNED' &&
      participant.dormitoryId !== null;

    expect(user.deletedAt !== null && registrationComplete).toBe(false);

    if (deletionSucceeded) {
      expect(user.deletedAt).not.toBeNull();
      expect(registrationComplete).toBe(false);
      expect(historyCount).toBe(0);
    }

    if (registrationSucceeded) {
      expect(user.deletedAt).toBeNull();
      expect(registrationComplete).toBe(true);
      expect(historyCount).toBe(1);
      expect(deleteResponse.body).toMatchObject({
        code: 'ACCOUNT_DELETION_BLOCKED_BY_SEASON_PARTICIPATION',
      });
    }
  });

  it('계정 삭제 요청은 현재 비밀번호가 틀리면 계정을 비식별화하지 않는다', async () => {
    await seedVerifiedUser({
      userId: 'user-password-mismatch',
      email: 'password-mismatch@kangwon.ac.kr',
      nickname: '비밀번호검증유저',
    });
    const accessToken = await issueAccessToken(
      'user-password-mismatch',
      'password-mismatch@kangwon.ac.kr',
    );

    const response = await request(httpServer)
      .post('/api/users/me/delete')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ password: 'Wrong1234' })
      .expect(400);

    expect((response.body as { code: string }).code).toBe('ACCOUNT_DELETION_PASSWORD_MISMATCH');
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: 'user-password-mismatch' },
    });
    expect(user.deletedAt).toBeNull();
  });

  it('season de-registration은 pending request와 direct thread를 withdrawn reason으로 정리하고 재참여를 막는다', async () => {
    await seedVerifiedUser({
      userId: 'user-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
      withParticipant: true,
    });
    await seedVerifiedUser({
      userId: 'user-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '유저B',
      withParticipant: true,
    });

    await prisma.matchRequest.create({
      data: {
        id: 'pending-request',
        seasonId: 'season-integration',
        pairKey: 'user-a-participant:user-b-participant',
        pairMinParticipantId: 'user-a-participant',
        pairMaxParticipantId: 'user-b-participant',
        requesterParticipantId: 'user-a-participant',
        receiverParticipantId: 'user-b-participant',
        status: 'PENDING',
        expiresAt: new Date((await prisma.getDatabaseNow()).getTime() + 60 * 60 * 1_000),
      },
    });

    await prisma.conversationThread.create({
      data: {
        id: 'direct-thread',
        seasonId: 'season-integration',
        pairKey: 'user-a-participant:user-b-participant',
        participantAId: 'user-a-participant',
        participantBId: 'user-b-participant',
        openedByParticipantId: 'user-a-participant',
        threadKind: 'DIRECT',
        status: 'OPEN',
      },
    });

    const accessToken = await issueAccessToken('user-a', 'user-a@kangwon.ac.kr');
    const response = await request(httpServer)
      .post('/api/seasons/current/participation/deregister')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    const body = response.body as { participationIntent: string; participantStatus: string };
    expect(body.participationIntent).toBe('DECLINED');
    expect(body.participantStatus).toBe('WITHDRAWN');

    const participant = await prisma.seasonParticipant.findUniqueOrThrow({
      where: { id: 'user-a-participant' },
    });
    expect(participant.participationIntent).toBe('DECLINED');
    expect(participant.participantStatus).toBe('WITHDRAWN');
    expect(participant.withdrawnAt).not.toBeNull();

    const pendingRequest = await prisma.matchRequest.findUniqueOrThrow({
      where: { id: 'pending-request' },
    });
    expect(pendingRequest.status).toBe('CANCELLED_BY_SYSTEM');
    expect(pendingRequest.terminalReason).toBe('WITHDRAWN_PARTICIPANT');

    const thread = await prisma.conversationThread.findUniqueOrThrow({
      where: { id: 'direct-thread' },
    });
    expect(thread.status).toBe('READ_ONLY');
    expect(thread.closedReason).toBe('PARTICIPANT_WITHDRAWN');

    await request(httpServer)
      .post('/api/seasons/current/participation/registration')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(409);
  });

  it('메시지가 있는 direct thread는 참여 철회 후 read-only가 되고 계정 삭제 후에도 탈퇴 사용자 표시와 함께 유지된다', async () => {
    await seedVerifiedUser({
      userId: 'user-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
      withParticipant: true,
    });
    await seedVerifiedUser({
      userId: 'user-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '유저B',
      withParticipant: true,
    });

    await prisma.conversationThread.create({
      data: {
        id: 'direct-thread-with-message',
        seasonId: 'season-integration',
        pairKey: 'user-a-participant:user-b-participant',
        participantAId: 'user-a-participant',
        participantBId: 'user-b-participant',
        openedByParticipantId: 'user-a-participant',
        threadKind: 'DIRECT',
        status: 'OPEN',
        lastMessageAt: new Date('2026-05-01T01:00:00.000Z'),
        members: {
          createMany: {
            data: [
              { participantId: 'user-a-participant' },
              { participantId: 'user-b-participant' },
            ],
          },
        },
        messages: {
          create: [
            {
              id: 'message-a-to-b-before-withdrawal',
              senderParticipantId: 'user-a-participant',
              body: '철회 전 A가 보낸 메시지',
              sentAt: new Date('2026-05-01T01:00:00.000Z'),
            },
            {
              id: 'message-b-to-a-before-withdrawal',
              senderParticipantId: 'user-b-participant',
              body: '철회 전 B가 보낸 메시지',
              sentAt: new Date('2026-05-01T01:01:00.000Z'),
            },
          ],
        },
      },
    });

    const userAAccessToken = await issueAccessToken('user-a', 'user-a@kangwon.ac.kr');
    const userBAccessToken = await issueAccessToken('user-b', 'user-b@kangwon.ac.kr');

    await request(httpServer)
      .post('/api/seasons/current/participation/deregister')
      .set('Authorization', `Bearer ${userAAccessToken}`)
      .expect(201);

    const threadAfterDeregistration = await prisma.conversationThread.findUniqueOrThrow({
      where: { id: 'direct-thread-with-message' },
    });
    expect(threadAfterDeregistration.status).toBe('READ_ONLY');
    expect(threadAfterDeregistration.closedReason).toBe('PARTICIPANT_WITHDRAWN');
    expect(threadAfterDeregistration.closedAt).not.toBeNull();

    const detailAfterDeregistration = await request(httpServer)
      .get('/api/chat/threads/direct-thread-with-message')
      .set('Authorization', `Bearer ${userBAccessToken}`)
      .expect(200);
    const detailAfterDeregistrationBody = detailAfterDeregistration.body as {
      thread: { status: string; closedReason: string | null; canSendMessage: boolean };
      messages: Array<{ id: string; body: string; senderUserId: string }>;
    };
    expect(detailAfterDeregistrationBody.thread).toMatchObject({
      status: 'READ_ONLY',
      closedReason: 'PARTICIPANT_WITHDRAWN',
      canSendMessage: false,
    });
    expect(detailAfterDeregistrationBody.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'message-a-to-b-before-withdrawal',
          senderUserId: 'user-a',
          body: '철회 전 A가 보낸 메시지',
        }),
        expect.objectContaining({
          id: 'message-b-to-a-before-withdrawal',
          senderUserId: 'user-b',
          body: '철회 전 B가 보낸 메시지',
        }),
      ]),
    );

    await request(httpServer)
      .post('/api/users/me/delete')
      .set('Authorization', `Bearer ${userAAccessToken}`)
      .send({ password: 'Pass1234' })
      .expect(201);

    const threadAfterDeletion = await prisma.conversationThread.findUniqueOrThrow({
      where: { id: 'direct-thread-with-message' },
    });
    expect(threadAfterDeletion.status).toBe('READ_ONLY');
    expect(threadAfterDeletion.closedReason).toBe('PARTICIPANT_WITHDRAWN');

    const anonymizedIdentity = await prisma.userDisplayIdentity.findUniqueOrThrow({
      where: { userId: 'user-a' },
    });
    expect(anonymizedIdentity.nickname).toBe('탈퇴한 사용자');
    expect(anonymizedIdentity.nicknameNormalized.startsWith('deleted-')).toBe(true);

    const retainedIdentity = await prisma.retainedIdentity.findUniqueOrThrow({
      where: { originalUserId: 'user-a' },
    });
    expect(retainedIdentity.displayLabel).toBe('탈퇴한 사용자');
    await expect(
      prisma.retainedIdentityHold.findFirst({
        where: { retainedIdentityId: retainedIdentity.id, holdReason: 'ACCOUNT_DELETION' },
        include: { retentionCase: true },
      }),
    ).resolves.toMatchObject({
      holdReason: 'ACCOUNT_DELETION',
      retentionCase: { reason: 'ACCOUNT_DELETION' },
    });
    const archiveJobs = await prisma.archiveJob.findMany({
      where: { retainedIdentityId: retainedIdentity.id },
      orderBy: { target: 'asc' },
    });
    expect(archiveJobs.map((job) => job.target)).toEqual(
      expect.arrayContaining([
        'ACADEMIC_IDENTITY_AUDIT',
        'SEASON_PROFILE_HISTORY',
        'THREAD_RETENTION',
        'NICKNAME_AUDIT',
      ]),
    );
    expect(archiveJobs).toHaveLength(4);
    const threadRetentionJob = archiveJobs.find((job) => job.target === 'THREAD_RETENTION');
    expect(threadRetentionJob).toMatchObject({
      threadId: 'direct-thread-with-message',
      status: 'WAITING_CONDITION',
    });

    const detailAfterDeletion = await request(httpServer)
      .get('/api/chat/threads/direct-thread-with-message')
      .set('Authorization', `Bearer ${userBAccessToken}`)
      .expect(200);
    const detailAfterDeletionBody = detailAfterDeletion.body as {
      thread: { status: string; closedReason: string | null; canSendMessage: boolean };
      messages: Array<{ id: string; body: string; senderUserId: string }>;
    };
    expect(detailAfterDeletionBody.thread).toMatchObject({
      status: 'READ_ONLY',
      closedReason: 'PARTICIPANT_WITHDRAWN',
      canSendMessage: false,
    });
    expect(detailAfterDeletionBody.messages.map((message) => message.id)).toEqual([
      'message-a-to-b-before-withdrawal',
      'message-b-to-a-before-withdrawal',
    ]);
  });

  it('live active match가 있는 참여자는 season de-registration을 거부한다', async () => {
    await seedVerifiedUser({
      userId: 'user-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
      withParticipant: true,
    });
    await seedVerifiedUser({
      userId: 'user-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '유저B',
      withParticipant: true,
    });
    await seedActiveMatchFixture(prisma, {
      activeMatchId: 'active-a-b',
      participantAId: 'user-a-participant',
      participantBId: 'user-b-participant',
      withMatchedThread: true,
    });

    const accessToken = await issueAccessToken('user-a', 'user-a@kangwon.ac.kr');
    const response = await request(httpServer)
      .post('/api/seasons/current/participation/deregister')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(409);

    expect((response.body as { code: string }).code).toBe(
      'SEASON_PARTICIPATION_DEREGISTRATION_NOT_ALLOWED',
    );

    const participant = await prisma.seasonParticipant.findUniqueOrThrow({
      where: { id: 'user-a-participant' },
    });
    expect(participant.participationIntent).toBe('REGISTERED');
    expect(participant.participantStatus).toBe('MATCHED');
    expect(participant.withdrawnAt).toBeNull();
  });

  it('SEASON_POST_MATCH에서는 live match가 없어도 season de-registration을 거부한다', async () => {
    await seedVerifiedUser({
      userId: 'user-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
      withParticipant: true,
    });
    await prisma.season.update({
      where: { id: 'season-integration' },
      data: {
        overrideState: 'SEASON_POST_MATCH',
        overrideStartedAt: await prisma.getDatabaseNow(),
        overrideEndsAt: null,
      },
    });

    const accessToken = await issueAccessToken('user-a', 'user-a@kangwon.ac.kr');
    const response = await request(httpServer)
      .post('/api/seasons/current/participation/deregister')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(409);

    expect((response.body as { code: string }).code).toBe(
      'SEASON_PARTICIPATION_DEREGISTRATION_NOT_ALLOWED',
    );

    const participant = await prisma.seasonParticipant.findUniqueOrThrow({
      where: { id: 'user-a-participant' },
    });
    expect(participant.participationIntent).toBe('REGISTERED');
    expect(participant.participantStatus).toBe('ACTIVE');
    expect(participant.withdrawnAt).toBeNull();
  });

  it('비참여 사용자의 삭제 요청은 즉시 비식별화하고 5일 후 retained identity anchor를 폐기한다', async () => {
    await seedVerifiedUser({
      userId: 'user-c',
      email: 'user-c@kangwon.ac.kr',
      nickname: '유저C',
    });
    const accessToken = await issueAccessToken('user-c', 'user-c@kangwon.ac.kr');

    const requestDelete = await request(httpServer)
      .post('/api/users/me/delete')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ password: 'Pass1234' })
      .expect(201);
    const requestDeleteBody = requestDelete.body as {
      state: string;
      deletedAt: string;
      retentionHoldUntil: string;
    };
    expect(requestDeleteBody.state).toBe('DEIDENTIFIED_RETAINED');
    expect(requestDeleteBody.deletedAt).toBeTruthy();
    expect(requestDeleteBody.retentionHoldUntil).toBeTruthy();

    const user = await prisma.user.findUniqueOrThrow({ where: { id: 'user-c' } });
    expect(user.deletedAt).not.toBeNull();
    expect(user.emailNormalized.startsWith('deleted+')).toBe(true);
    expect(user.emailVerifiedAt).toBeNull();

    const displayIdentity = await prisma.userDisplayIdentity.findUniqueOrThrow({
      where: { userId: 'user-c' },
    });
    expect(displayIdentity.nickname).toBe('탈퇴한 사용자');
    expect(displayIdentity.nicknameNormalized.startsWith('deleted-')).toBe(true);

    await expect(
      prisma.userAcademicIdentity.findUnique({ where: { userId: 'user-c' } }),
    ).resolves.toBeNull();
    await expect(
      prisma.userAcademicIdentityChangeAllowance.findUnique({ where: { userId: 'user-c' } }),
    ).resolves.toBeNull();

    const retainedIdentity = await prisma.retainedIdentity.findUniqueOrThrow({
      where: { originalUserId: 'user-c' },
    });
    const retainedIdentityHold = await prisma.retainedIdentityHold.findFirstOrThrow({
      where: { retainedIdentityId: retainedIdentity.id, holdReason: 'ACCOUNT_DELETION' },
      include: { retentionCase: true },
    });
    expect(retainedIdentityHold.retentionCase.reason).toBe('ACCOUNT_DELETION');
    expect(retainedIdentityHold.holdUntil?.toISOString()).toBe(
      requestDeleteBody.retentionHoldUntil,
    );

    const nicknameEvent = await prisma.userDisplayIdentityNicknameChangeEvent.findFirstOrThrow({
      where: {
        userId: 'user-c',
        source: 'ACCOUNT_DELETION_DEIDENTIFICATION',
      },
    });
    expect(nicknameEvent).toMatchObject({
      retainedIdentityId: retainedIdentity.id,
      reason: 'ACCOUNT_DELETION',
      actorType: 'SYSTEM',
      actorId: 'account-deletion',
      previousNickname: '유저C',
      previousNicknameNormalized: '유저C',
      nextNickname: '탈퇴한 사용자',
      nextNicknameNormalized: displayIdentity.nicknameNormalized,
    });

    const archiveJobs = await prisma.archiveJob.findMany({
      where: { retainedIdentityId: retainedIdentity.id },
      orderBy: { target: 'asc' },
    });
    expect(archiveJobs.map((job) => job.target).sort()).toEqual([
      'ACADEMIC_IDENTITY_AUDIT',
      'NICKNAME_AUDIT',
    ]);

    await request(httpServer)
      .post('/api/users/me/delete/cancel')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    await request(httpServer)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    const sixDaysLater = new Date(
      new Date(requestDeleteBody.deletedAt).getTime() + 6 * 24 * 60 * 60 * 1_000,
    );
    const sweepResult = await lifecycleSweepService.runSweep(sixDaysLater);
    expect(sweepResult.archiveJobSweep.succeededCount).toBeGreaterThanOrEqual(1);
    expect(sweepResult.retainedIdentityDisposalSweep.processedCount).toBe(2);

    const disposedIdentity = await prisma.retainedIdentity.findUniqueOrThrow({
      where: { id: retainedIdentity.id },
    });
    expect(disposedIdentity.originalUserId).toBeNull();
    expect(disposedIdentity.emailHash).toBeNull();
    expect(disposedIdentity.encryptedIdentifierPayload).toBeNull();
    expect(disposedIdentity.identifierKeyVersion).toBeNull();
    expect(disposedIdentity.retentionDisposalReason).toBe('RETENTION_HOLD_EXPIRED');

    const disposalLog = await prisma.retentionAccessLog.findFirst({
      where: {
        retainedIdentityId: retainedIdentity.id,
        targetType: 'IDENTITY_ANCHOR',
        result: 'DISPOSED',
      },
    });
    expect(disposalLog).not.toBeNull();

    const completedArchiveJobs = await prisma.archiveJob.findMany({
      where: { retainedIdentityId: retainedIdentity.id },
    });
    expect(completedArchiveJobs.every((job) => job.status === 'SUCCEEDED')).toBe(true);
  });

  it('등록 전 season profile draft는 계정 삭제 수락 시 current profile 식별/생활패턴 필드를 비식별화한다', async () => {
    await seedVerifiedUser({
      userId: 'user-draft-profile',
      email: 'draft-profile@kangwon.ac.kr',
      nickname: '드래프트유저',
    });
    await prisma.seasonParticipant.create({
      data: {
        id: 'user-draft-profile-participant',
        seasonId: 'season-integration',
        userId: 'user-draft-profile',
        participationIntent: 'UNDECIDED',
        dormitorySelectionState: 'NOT_SELECTED',
        participantStatus: 'DRAFT',
        campusCodeSnapshot: 'CHUNCHEON',
        genderSnapshot: 'M',
      },
    });
    await prisma.seasonParticipantProfile.create({
      data: {
        participantId: 'user-draft-profile-participant',
        nicknameSnapshot: '드래프트유저',
        nicknameNormalizedSnapshot: '드래프트유저',
        bedtime: 'BETWEEN_22_24',
        wakeTime: 'BETWEEN_07_08',
        smokingBehavior: 'NO',
        relationshipStyle: 'CLOSE',
        intro: '등록 전 소개',
        grade: '2',
        mbti: 'INTJ',
        birthYear: 2000,
      },
    });
    const accessToken = await issueAccessToken('user-draft-profile', 'draft-profile@kangwon.ac.kr');

    await request(httpServer)
      .post('/api/users/me/delete')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ password: 'Pass1234' })
      .expect(201);

    const draftProfile = await prisma.seasonParticipantProfile.findUniqueOrThrow({
      where: { participantId: 'user-draft-profile-participant' },
    });
    expect(draftProfile.nicknameSnapshot).toBe('탈퇴한 사용자');
    expect(draftProfile.nicknameNormalizedSnapshot.startsWith('deleted-')).toBe(true);
    expect(draftProfile.intro).toBe('');
    expect(draftProfile.bedtime).toBeNull();
    expect(draftProfile.wakeTime).toBeNull();
    expect(draftProfile.smokingBehavior).toBeNull();
    expect(draftProfile.relationshipStyle).toBeNull();
    expect(draftProfile.collegeCode).toBeNull();
    expect(draftProfile.grade).toBeNull();
    expect(draftProfile.mbti).toBeNull();
    expect(draftProfile.birthYear).toBeNull();

    const seasonHistoryCount = await prisma.seasonParticipantProfileHistory.count({
      where: { participantId: 'user-draft-profile-participant' },
    });
    expect(seasonHistoryCount).toBe(0);
  });

  it('정상 계정 삭제는 season profile history retention snapshot을 자동 생성하지 않는다', async () => {
    await seedVerifiedUser({
      userId: 'user-no-history',
      email: 'user-no-history@kangwon.ac.kr',
      nickname: '히스토리없음',
    });
    const accessToken = await issueAccessToken('user-no-history', 'user-no-history@kangwon.ac.kr');

    await request(httpServer)
      .post('/api/users/me/delete')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ password: 'Pass1234' })
      .expect(201);

    const seasonHistoryCount = await prisma.seasonParticipantProfileHistory.count();
    expect(seasonHistoryCount).toBe(0);

    const retainedIdentity = await prisma.retainedIdentity.findFirstOrThrow({
      where: { originalUserId: 'user-no-history' },
    });
    await expect(
      prisma.retainedIdentityHold.findFirst({
        where: { retainedIdentityId: retainedIdentity.id, holdReason: 'ACCOUNT_DELETION' },
      }),
    ).resolves.toMatchObject({ holdReason: 'ACCOUNT_DELETION' });
  });
});

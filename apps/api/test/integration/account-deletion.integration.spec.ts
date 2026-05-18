import request from 'supertest';
import { AuthSessionService } from '../../src/auth/auth-session.service.js';
import { hashPassword } from '../../src/auth/auth-password.js';
import { LifecycleSweepService } from '../../src/common/lifecycle/lifecycle-sweep.service.js';
import { PrismaService } from '../../src/common/prisma/prisma.service.js';
import { createIntegrationApp } from './support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from './support/integration-db.js';
import { seedBaseSeasonFixtures } from './support/integration-fixtures.js';

describe('account deletion integration', () => {
  jest.setTimeout(60_000);

  let prisma: PrismaService;
  let authSessionService: AuthSessionService;
  let lifecycleSweepService: LifecycleSweepService;
  let httpServer: Parameters<typeof request>[0];
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
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

    await prisma.userProfile.create({
      data: {
        userId: input.userId,
        nickname: input.nickname,
        nicknameNormalized: input.nickname,
        intro: `${input.nickname} 소개`,
      },
    });

    if (input.withParticipant) {
      await prisma.seasonParticipant.create({
        data: {
          id: `${input.userId}-participant`,
          seasonId: 'season-integration',
          userId: input.userId,
          participationIntent: 'REGISTERED',
          registeredAt: new Date(now.getTime() - 24 * 60 * 60 * 1_000),
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
          messageToRoommate: `${input.nickname} 시즌 메시지`,
        },
      });
    }
  }

  async function issueAccessToken(userId: string, email: string) {
    const issued = await authSessionService.issueAuthResult(userId, email, false);
    return issued.accessToken;
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

    const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId: 'user-c' } });
    expect(profile.nickname).toBe('탈퇴한 사용자');
    expect(profile.intro).toBe('');
    expect(profile.messageToRoommate).toBeNull();

    const retainedIdentity = await prisma.retainedIdentity.findUniqueOrThrow({
      where: { originalUserId: 'user-c' },
    });
    expect(retainedIdentity.retentionReason).toBe('ACCOUNT_DELETION');
    expect(retainedIdentity.retentionHoldUntil?.toISOString()).toBe(
      requestDeleteBody.retentionHoldUntil,
    );
    const archiveJobs = await prisma.archiveJob.findMany({
      where: { retainedIdentityId: retainedIdentity.id },
      orderBy: { target: 'asc' },
    });
    expect(archiveJobs.map((job) => job.target)).toEqual(['RETAINED_IDENTITY']);

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
    expect(sweepResult.retainedIdentityDisposalSweep.processedCount).toBe(1);

    const disposedIdentity = await prisma.retainedIdentity.findUniqueOrThrow({
      where: { id: retainedIdentity.id },
    });
    expect(disposedIdentity.originalUserId).toBeNull();
    expect(disposedIdentity.emailHash).toBeNull();
    expect(disposedIdentity.encryptedIdentifierPayload).toBeNull();
    expect(disposedIdentity.identifierKeyVersion).toBeNull();
    expect(disposedIdentity.retentionDisposalReason).toBe('RETENTION_HOLD_EXPIRED');

    const disposalLog = await prisma.retainedIdentityDataAccessLog.findFirst({
      where: {
        retainedIdentityId: retainedIdentity.id,
        result: 'DISPOSED',
      },
    });
    expect(disposalLog).not.toBeNull();

    const completedArchiveJobs = await prisma.archiveJob.findMany({
      where: { retainedIdentityId: retainedIdentity.id },
    });
    expect(completedArchiveJobs.every((job) => job.status === 'SUCCEEDED')).toBe(true);
  });

  it('정상 계정 삭제는 full profile history retention snapshot을 자동 생성하지 않는다', async () => {
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

    const userHistoryCount = await prisma.userProfileHistory.count({
      where: { userId: 'user-no-history', source: 'RETENTION_SNAPSHOT' },
    });
    expect(userHistoryCount).toBe(0);

    const retainedIdentity = await prisma.retainedIdentity.findFirstOrThrow({
      where: { originalUserId: 'user-no-history' },
    });
    expect(retainedIdentity.retentionReason).toBe('ACCOUNT_DELETION');
  });
});

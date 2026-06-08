import {
  createBookmarkResponseSchema,
  deleteBookmarkResponseSchema,
  bookmarkListResponseSchema,
} from '@repo/shared/social-safety/bookmark';
import { roommateSearchResponseSchema } from '@repo/shared/roommate-search-contract';
import request from 'supertest';
import { AuthSessionService } from '../../src/auth/sessions/auth-session.service.js';
import { LifecycleSweepService } from '../../src/lifecycle/lifecycle-sweep.service.js';
import { PrismaService } from '../../src/platform/database/prisma.service.js';
import { createIntegrationApp } from './support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from './support/integration-db.js';
import {
  seedBaseSeasonFixtures,
  seedOperatedDormitoryFixture,
  seedRegisteredAssignedParticipant,
} from './support/integration-fixtures.js';

describe('Social-safety bookmark integration', () => {
  jest.setTimeout(60_000);

  let prisma: PrismaService;
  let authSessionService: AuthSessionService;
  let lifecycleSweepService: LifecycleSweepService;
  let httpServer: Parameters<typeof request>[0];
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const sandbox = await createIntegrationDatabaseSandbox('ss_bookmark');
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
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'viewer-user',
      participantId: 'viewer-participant',
      email: 'viewer@kangwon.ac.kr',
      nickname: '뷰어',
    });
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'target-user',
      participantId: 'target-participant',
      email: 'target@kangwon.ac.kr',
      nickname: '타겟',
    });
  });

  async function issueAccessToken(userId: string, email: string) {
    const issued = await authSessionService.issueAuthResult(userId, email, false);
    return issued.accessToken;
  }

  async function authHeader(userId = 'viewer-user', email = 'viewer@kangwon.ac.kr') {
    return `Bearer ${await issueAccessToken(userId, email)}`;
  }

  async function seedActiveBookmark(
    input: {
      viewerUserId?: string;
      targetUserId?: string;
      targetParticipantId?: string;
    } = {},
  ) {
    const targetParticipantId = input.targetParticipantId ?? 'target-participant';
    const now = await prisma.getDatabaseNow();
    await prisma.userBookmark.create({
      data: {
        viewerUserId: input.viewerUserId ?? 'viewer-user',
        seasonId: 'season-integration',
        targetUserId:
          input.targetUserId ??
          (targetParticipantId === 'target-participant' ? 'target-user' : 'hidden-user'),
        targetParticipantId,
        bookmarkedAt: now,
      },
    });
  }

  it('same target concurrent create leaves one active row and returns idempotent responses', async () => {
    const authorization = await authHeader();

    const [first, second] = await Promise.all([
      request(httpServer)
        .post('/api/bookmarks/target-user')
        .set('Authorization', authorization)
        .expect(201),
      request(httpServer)
        .post('/api/bookmarks/target-user')
        .set('Authorization', authorization)
        .expect(201),
    ]);

    const firstBody = createBookmarkResponseSchema.parse(first.body);
    const secondBody = createBookmarkResponseSchema.parse(second.body);

    expect([firstBody.created, secondBody.created].sort()).toEqual([false, true]);
    await expect(
      prisma.userBookmark.count({
        where: {
          viewerUserId: 'viewer-user',
          seasonId: 'season-integration',
          targetParticipantId: 'target-participant',
          deletedAt: null,
          expiredAt: null,
        },
      }),
    ).resolves.toBe(1);
  });

  it('other dormitory target은 probing-safe not bookmarkable로 닫힌다', async () => {
    await seedOperatedDormitoryFixture(prisma, { id: 'yulgok', nameKo: '율곡관' });
    await prisma.seasonParticipant.update({
      where: { id: 'target-participant' },
      data: { dormitoryId: 'yulgok' },
    });

    const createResponse = await request(httpServer)
      .post('/api/bookmarks/target-user')
      .set('Authorization', await authHeader())
      .expect(404);
    const createErrorBody: unknown = createResponse.body;
    expect(createErrorBody).toMatchObject({ code: 'TARGET_NOT_BOOKMARKABLE' });
  });

  it('other campus target은 probing-safe not bookmarkable로 닫힌다', async () => {
    await prisma.user.update({
      where: { id: 'target-user' },
      data: { campus: 'SAMCHEOK' },
    });

    const createResponse = await request(httpServer)
      .post('/api/bookmarks/target-user')
      .set('Authorization', await authHeader())
      .expect(404);
    const createErrorBody: unknown = createResponse.body;
    expect(createErrorBody).toMatchObject({ code: 'TARGET_NOT_BOOKMARKABLE' });
  });

  it('SEASON_POST_MATCH에서는 신규 bookmark create가 닫힌다', async () => {
    await prisma.season.update({
      where: { id: 'season-integration' },
      data: {
        overrideState: 'SEASON_POST_MATCH',
        overrideStartedAt: await prisma.getDatabaseNow(),
      },
    });

    const createResponse = await request(httpServer)
      .post('/api/bookmarks/target-user')
      .set('Authorization', await authHeader())
      .expect(404);
    const createErrorBody: unknown = createResponse.body;
    expect(createErrorBody).toMatchObject({ code: 'TARGET_NOT_BOOKMARKABLE' });
  });

  it.each([
    ['hidden', { hiddenByAdminAt: new Date('2026-06-08T00:00:00.000Z') }],
    ['deactivated', { deactivatedAt: new Date('2026-06-08T00:00:00.000Z') }],
    [
      'withdrawn',
      {
        participationIntent: 'DECLINED',
        participantStatus: 'WITHDRAWN',
        withdrawnAt: new Date('2026-06-08T00:00:00.000Z'),
      },
    ],
    ['expired', { participantStatus: 'EXPIRED', expiredAt: new Date('2026-06-08T00:00:00.000Z') }],
    ['deleted/deidentified', { userDeletedAt: new Date('2026-06-08T00:00:00.000Z') }],
  ])('%s target은 create와 list에서 fail-closed 된다', async (_caseName, state) => {
    if ('userDeletedAt' in state) {
      await prisma.user.update({
        where: { id: 'target-user' },
        data: { deletedAt: state.userDeletedAt },
      });
    } else {
      await prisma.seasonParticipant.update({
        where: { id: 'target-participant' },
        data: state,
      });
    }
    await seedActiveBookmark();

    const authorization = await authHeader();
    const createResponse = await request(httpServer)
      .post('/api/bookmarks/target-user')
      .set('Authorization', authorization)
      .expect(404);
    const createErrorBody: unknown = createResponse.body;
    expect(createErrorBody).toMatchObject({ code: 'TARGET_NOT_BOOKMARKABLE' });

    const listResponse = await request(httpServer)
      .get('/api/bookmarks')
      .set('Authorization', authorization)
      .expect(200);
    const listBody = bookmarkListResponseSchema.parse(listResponse.body);
    expect(listBody).toMatchObject({
      items: [],
      emptyState: { code: 'NO_VISIBLE_BOOKMARKS' },
    });
  });

  it('delete는 viewer 소유 active bookmark만 soft-delete하고 idempotent하게 닫는다', async () => {
    await seedActiveBookmark();

    const firstResponse = await request(httpServer)
      .delete('/api/bookmarks/target-user')
      .set('Authorization', await authHeader())
      .expect(200);
    expect(deleteBookmarkResponseSchema.parse(firstResponse.body)).toMatchObject({ deleted: true });

    const deletedBookmark = await prisma.userBookmark.findFirstOrThrow({
      where: { viewerUserId: 'viewer-user', targetUserId: 'target-user' },
    });
    expect(deletedBookmark.deletedAt).toBeInstanceOf(Date);

    const secondResponse = await request(httpServer)
      .delete('/api/bookmarks/target-user')
      .set('Authorization', await authHeader())
      .expect(200);
    expect(deleteBookmarkResponseSchema.parse(secondResponse.body)).toMatchObject({
      deleted: false,
    });
  });

  it('delete는 다른 viewer의 active bookmark를 삭제하지 않는다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'other-viewer-user',
      participantId: 'other-viewer-participant',
      email: 'other-viewer@kangwon.ac.kr',
      nickname: '다른뷰어',
    });
    await seedActiveBookmark({ viewerUserId: 'other-viewer-user' });

    const response = await request(httpServer)
      .delete('/api/bookmarks/target-user')
      .set('Authorization', await authHeader())
      .expect(200);
    expect(deleteBookmarkResponseSchema.parse(response.body)).toMatchObject({ deleted: false });

    await expect(
      prisma.userBookmark.count({
        where: {
          viewerUserId: 'other-viewer-user',
          targetUserId: 'target-user',
          deletedAt: null,
          expiredAt: null,
        },
      }),
    ).resolves.toBe(1);
  });

  it('roommate search marks bookmarked visible candidates and never revives hidden bookmarked targets', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'hidden-user',
      participantId: 'hidden-participant',
      email: 'hidden@kangwon.ac.kr',
      nickname: '숨김',
    });
    await prisma.seasonParticipant.update({
      where: { id: 'hidden-participant' },
      data: { hiddenByAdminAt: await prisma.getDatabaseNow() },
    });
    await seedActiveBookmark({ targetParticipantId: 'target-participant' });
    await seedActiveBookmark({
      targetUserId: 'hidden-user',
      targetParticipantId: 'hidden-participant',
    });

    const response = await request(httpServer)
      .get('/api/roommate-search')
      .query({ scope: 'SAME_BUILDING_ONLY', limit: 20 })
      .set('Authorization', await authHeader())
      .expect(200);

    const body = roommateSearchResponseSchema.parse(response.body);
    expect(body.items.map((item) => item.id)).toContain('target-user');
    expect(body.items.map((item) => item.id)).not.toContain('hidden-user');
    const targetItem = body.items.find((item) => item.id === 'target-user');
    expect(targetItem?.bookmark?.bookmarked).toBe(true);
    expect(typeof targetItem?.bookmark?.bookmarkedAt).toBe('string');
  });

  it('lifecycle sweep expires active bookmarks whose season has ended', async () => {
    await seedActiveBookmark();
    await prisma.season.update({
      where: { id: 'season-integration' },
      data: {
        seasonEndDate: new Date('2026-01-01T00:00:00.000Z'),
        overrideState: 'OFF_SEASON',
        overrideStartedAt: await prisma.getDatabaseNow(),
      },
    });

    const result = await lifecycleSweepService.runSweep(new Date('2026-06-08T00:00:00.000Z'));

    expect(result.socialSafetyBookmarkCleanupSweep).toEqual({ scannedCount: 1, expiredCount: 1 });
    const bookmark = await prisma.userBookmark.findFirstOrThrow({
      where: { viewerUserId: 'viewer-user', targetUserId: 'target-user' },
    });
    expect(bookmark.expiredAt).toEqual(new Date('2026-06-08T00:00:00.000Z'));
  });
});

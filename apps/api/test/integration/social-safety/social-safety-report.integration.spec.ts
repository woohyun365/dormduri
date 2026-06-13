import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createReportResponseSchema } from '@repo/shared/social-safety/report';
import request from 'supertest';
import { AuthSessionService } from '../../../src/auth/sessions/auth-session.service.js';
import { PrismaService } from '../../../src/platform/database/prisma.service.js';
import { createIntegrationApp } from '../_support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from '../_support/integration-db.js';
import {
  seedActiveMatchFixture,
  seedBaseSeasonFixtures,
  seedRegisteredAssignedParticipant,
} from '../_support/integration-fixtures.js';

describe('Social-safety report intake integration', () => {
  let prisma: PrismaService;
  let authSessionService: AuthSessionService;
  let httpServer: Parameters<typeof request>[0];
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const sandbox = await createIntegrationDatabaseSandbox('ss_report');
    cleanupDb = sandbox.cleanup;

    const { app, prisma: prismaService } = await createIntegrationApp();
    closeApp = () => app.close();
    prisma = prismaService;
    authSessionService = app.get(AuthSessionService);
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

  function pairKey() {
    return ['viewer-participant', 'target-participant'].sort().join(':');
  }

  async function seedPendingMatchRequest() {
    await prisma.matchRequest.create({
      data: {
        id: 'report-match-request',
        seasonId: 'season-integration',
        pairKey: pairKey(),
        pairMinParticipantId: ['viewer-participant', 'target-participant'].sort()[0]!,
        pairMaxParticipantId: ['viewer-participant', 'target-participant'].sort()[1]!,
        requesterParticipantId: 'viewer-participant',
        receiverParticipantId: 'target-participant',
        status: 'PENDING',
        createdAt: new Date('2026-06-08T00:00:00.000Z'),
        expiresAt: new Date('2026-07-08T00:00:00.000Z'),
      },
    });
  }

  async function seedDirectThreadWithMessage() {
    await prisma.conversationThread.create({
      data: {
        id: 'report-thread',
        seasonId: 'season-integration',
        pairKey: pairKey(),
        participantAId: ['viewer-participant', 'target-participant'].sort()[0]!,
        participantBId: ['viewer-participant', 'target-participant'].sort()[1]!,
        openedByParticipantId: 'viewer-participant',
        threadKind: 'DIRECT',
        status: 'READ_ONLY',
        closedReason: 'USER_BLOCKED',
        closedAt: await prisma.getDatabaseNow(),
      },
    });
    await prisma.conversationThreadMember.createMany({
      data: [
        { threadId: 'report-thread', participantId: 'viewer-participant' },
        { threadId: 'report-thread', participantId: 'target-participant' },
      ],
    });
    await prisma.conversationMessage.create({
      data: {
        id: 'report-message',
        threadId: 'report-thread',
        senderParticipantId: 'target-participant',
        body: 'notification이나 report event에 복사되면 안 되는 원문',
        sentAt: await prisma.getDatabaseNow(),
      },
    });
  }

  it('profile report는 intake case/event/receipt notification을 만들고 response status는 RECEIVED만 반환한다', async () => {
    const response = await request(httpServer)
      .post('/api/reports')
      .set('Authorization', await authHeader())
      .send({
        targetType: 'PROFILE',
        targetId: 'target-user',
        reason: 'SEXUAL_HARASSMENT',
        detail: '신고 상세는 notification payload에 들어가면 안 됩니다.',
        falseReportDisclaimerAccepted: true,
      })
      .expect(201);

    const body = createReportResponseSchema.parse(response.body);
    expect(body).toMatchObject({
      received: true,
      report: { targetType: 'PROFILE', reason: 'SEXUAL_HARASSMENT', status: 'RECEIVED' },
      optionalActionResult: null,
    });

    await expect(prisma.reportCase.count()).resolves.toBe(1);
    await expect(
      prisma.reportCaseEvent.count({ where: { eventType: 'REPORT_SUBMITTED' } }),
    ).resolves.toBe(1);
    await expect(
      prisma.reportCaseEvent.count({ where: { eventType: 'HIGH_RISK_ALERT_CANDIDATE_RECORDED' } }),
    ).resolves.toBe(1);
    const notification = await prisma.userNotification.findFirstOrThrow({
      where: { recipientUserId: 'viewer-user', kind: 'REPORT_RECEIVED' },
    });
    expect(notification.payload).toMatchObject({
      kind: 'REPORT_RECEIVED',
      reportId: body.report.id,
      status: 'RECEIVED',
    });
    expect(JSON.stringify(notification.payload)).not.toContain('신고 상세');
  });

  it('same reporter/target/reason concurrent report는 하나의 open case로 수렴한다', async () => {
    const authorization = await authHeader();

    const [first, second] = await Promise.all([
      request(httpServer)
        .post('/api/reports')
        .set('Authorization', authorization)
        .send({
          targetType: 'PROFILE',
          targetId: 'target-user',
          reason: 'OTHER',
          falseReportDisclaimerAccepted: true,
        })
        .expect(201),
      request(httpServer)
        .post('/api/reports')
        .set('Authorization', authorization)
        .send({
          targetType: 'PROFILE',
          targetId: 'target-user',
          reason: 'OTHER',
          falseReportDisclaimerAccepted: true,
        })
        .expect(201),
    ]);

    const bodies = [
      createReportResponseSchema.parse(first.body),
      createReportResponseSchema.parse(second.body),
    ];
    expect(bodies.map((body) => body.received).sort()).toEqual([false, true]);
    expect(new Set(bodies.map((body) => body.report.id)).size).toBe(1);
    await expect(prisma.reportCase.count()).resolves.toBe(1);
    await expect(
      prisma.reportCaseEvent.count({ where: { eventType: 'REPORT_REPLAYED' } }),
    ).resolves.toBe(1);
  });

  it('optional block active match 실패는 report를 rollback하지 않고 result/event로 기록한다', async () => {
    await seedActiveMatchFixture(prisma, {
      activeMatchId: 'active-match-report',
      participantAId: 'viewer-participant',
      participantBId: 'target-participant',
    });

    const response = await request(httpServer)
      .post('/api/reports')
      .set('Authorization', await authHeader())
      .send({
        targetType: 'PROFILE',
        targetId: 'target-user',
        reason: 'THREAT',
        optionalAction: 'BLOCK_TARGET',
        falseReportDisclaimerAccepted: true,
      })
      .expect(201);

    const body = createReportResponseSchema.parse(response.body);
    expect(body).toMatchObject({
      received: true,
      optionalActionResult: {
        action: 'BLOCK_TARGET',
        status: 'FAILED',
        code: 'ACTIVE_MATCH_BLOCK_NOT_ALLOWED',
      },
    });
    await expect(prisma.reportCase.count()).resolves.toBe(1);
    await expect(prisma.userBlock.count()).resolves.toBe(0);
    await expect(
      prisma.reportCaseEvent.count({ where: { eventType: 'OPTIONAL_BLOCK_RESULT_RECORDED' } }),
    ).resolves.toBe(1);
  });

  it('match request report는 당사자 request pointer만 snapshot하고 lifecycle을 변경하지 않는다', async () => {
    await seedPendingMatchRequest();

    const response = await request(httpServer)
      .post('/api/reports')
      .set('Authorization', await authHeader())
      .send({
        targetType: 'MATCH_REQUEST',
        targetId: 'report-match-request',
        reason: 'HATE_OR_DISCRIMINATION',
        falseReportDisclaimerAccepted: true,
      })
      .expect(201);
    const body = createReportResponseSchema.parse(response.body);

    const reportCase = await prisma.reportCase.findUniqueOrThrow({ where: { id: body.report.id } });
    expect(reportCase.targetType).toBe('MATCH_REQUEST');
    expect(reportCase.targetMatchRequestId).toBe('report-match-request');
    expect(reportCase.targetUserId).toBe('target-user');
    await expect(
      prisma.matchRequest.findUniqueOrThrow({ where: { id: 'report-match-request' } }),
    ).resolves.toMatchObject({ status: 'PENDING', terminalReason: null });
  });

  it('chat thread report는 thread pointer만 snapshot하고 chat state를 변경하지 않는다', async () => {
    await seedDirectThreadWithMessage();

    const response = await request(httpServer)
      .post('/api/reports')
      .set('Authorization', await authHeader())
      .send({
        targetType: 'CHAT_THREAD',
        targetId: 'report-thread',
        reason: 'OTHER',
        falseReportDisclaimerAccepted: true,
      })
      .expect(201);
    const body = createReportResponseSchema.parse(response.body);

    const reportCase = await prisma.reportCase.findUniqueOrThrow({ where: { id: body.report.id } });
    expect(reportCase.targetType).toBe('CHAT_THREAD');
    expect(reportCase.targetThreadId).toBe('report-thread');
    expect(reportCase.targetUserId).toBe('target-user');
    await expect(
      prisma.conversationThread.findUniqueOrThrow({ where: { id: 'report-thread' } }),
    ).resolves.toMatchObject({ status: 'READ_ONLY', closedReason: 'USER_BLOCKED' });
  });

  it('support ticket target은 Phase 7 전까지 probing-safe unsupported로 닫는다', async () => {
    const response = await request(httpServer)
      .post('/api/reports')
      .set('Authorization', await authHeader())
      .send({
        targetType: 'SUPPORT_TICKET',
        targetId: 'support-ticket-id',
        reason: 'OTHER',
        falseReportDisclaimerAccepted: true,
      })
      .expect(400);

    expect(response.body).toMatchObject({ code: 'REPORT_TARGET_NOT_SUPPORTED' });
    await expect(prisma.reportCase.count()).resolves.toBe(0);
  });

  it('hidden target profile은 report intake에서 projection 변경 없이 probing-safe reject한다', async () => {
    await prisma.seasonParticipant.update({
      where: { id: 'target-participant' },
      data: {
        hiddenByAdminAt: await prisma.getDatabaseNow(),
        hiddenReasonCode: 'SAFETY_REVIEW',
      },
    });

    const response = await request(httpServer)
      .post('/api/reports')
      .set('Authorization', await authHeader())
      .send({
        targetType: 'PROFILE',
        targetId: 'target-user',
        reason: 'OTHER',
        falseReportDisclaimerAccepted: true,
      })
      .expect(404);

    expect(response.body).toMatchObject({ code: 'REPORT_TARGET_NOT_REPORTABLE' });
    await expect(prisma.reportCase.count()).resolves.toBe(0);
    await expect(
      prisma.seasonParticipant.findUniqueOrThrow({ where: { id: 'target-participant' } }),
    ).resolves.toMatchObject({ hiddenReasonCode: 'SAFETY_REVIEW' });
  });

  it('FALSE_PROFILE profile report는 feedback candidate만 기록하고 실제 feedback notification은 발송하지 않는다', async () => {
    const response = await request(httpServer)
      .post('/api/reports')
      .set('Authorization', await authHeader())
      .send({
        targetType: 'PROFILE',
        targetId: 'target-user',
        reason: 'FALSE_PROFILE',
        falseReportDisclaimerAccepted: true,
      })
      .expect(201);
    createReportResponseSchema.parse(response.body);

    await expect(
      prisma.reportCaseEvent.count({
        where: { eventType: 'PROFILE_MISMATCH_FEEDBACK_CANDIDATE_RECORDED' },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.userNotification.count({ where: { kind: { not: 'REPORT_RECEIVED' } } }),
    ).resolves.toBe(0);
    await expect(
      prisma.seasonParticipant.count({ where: { hiddenByAdminAt: { not: null } } }),
    ).resolves.toBe(0);
  });

  it('chat message report는 raw body 없이 message pointer와 unverified attachment pointer event만 남긴다', async () => {
    await seedDirectThreadWithMessage();

    const response = await request(httpServer)
      .post('/api/reports')
      .set('Authorization', await authHeader())
      .send({
        targetType: 'CHAT_MESSAGE',
        targetId: 'report-message',
        reason: 'SPAM_OR_AD',
        evidenceAttachmentIds: ['attachment-pointer-1'],
        falseReportDisclaimerAccepted: true,
      })
      .expect(201);
    const body = createReportResponseSchema.parse(response.body);

    const reportCase = await prisma.reportCase.findUniqueOrThrow({ where: { id: body.report.id } });
    expect(reportCase.targetMessageId).toBe('report-message');
    expect(JSON.stringify(reportCase.targetSnapshot)).not.toContain(
      'notification이나 report event',
    );
    await expect(
      prisma.reportCaseEvent.count({
        where: { eventType: 'UNVERIFIED_ATTACHMENT_POINTERS_RECORDED' },
      }),
    ).resolves.toBe(1);
  });
});

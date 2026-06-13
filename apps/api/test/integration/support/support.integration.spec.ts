import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { AuthSessionService } from '../../../src/auth/sessions/auth-session.service.js';
import { PrismaService } from '../../../src/platform/database/prisma.service.js';
import { createIntegrationApp } from '../_support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from '../_support/integration-db.js';
import {
  seedBaseSeasonFixtures,
  seedRegisteredAssignedParticipant,
} from '../_support/integration-fixtures.js';

interface SupportTicketResponseBody {
  ticket: {
    id: string;
    status: string;
  };
}

interface SupportTicketListResponseBody {
  items: unknown[];
}

interface SupportTicketDetailResponseBody {
  messages: Array<{
    senderType: string;
    body: string;
  }>;
}

interface SupportFaqListResponseBody {
  items: Array<{
    id: string;
    question: string;
  }>;
}

describe('Support integration', () => {
  let prisma: PrismaService;
  let authSessionService: AuthSessionService;
  let httpServer: Parameters<typeof request>[0];
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const sandbox = await createIntegrationDatabaseSandbox('support_integration');
    cleanupDb = sandbox.cleanup;

    const { app, prisma: prismaService } = await createIntegrationApp();
    closeApp = () => app.close();
    httpServer = app.getHttpServer() as Parameters<typeof request>[0];
    prisma = prismaService;
    authSessionService = app.get(AuthSessionService);
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
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-b',
      participantId: 'participant-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '유저B',
    });
  });

  async function issueAccessToken(userId: string, email: string) {
    const issued = await authSessionService.issueAuthResult(userId, email, false);
    return issued.accessToken;
  }

  it('사용자는 support ticket을 생성하고 본인 ticket만 list/detail/reply할 수 있다', async () => {
    const userAToken = await issueAccessToken('user-a', 'user-a@kangwon.ac.kr');
    const userBToken = await issueAccessToken('user-b', 'user-b@kangwon.ac.kr');

    const createResponse = await request(httpServer)
      .post('/api/support/tickets')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        category: 'APPEAL',
        appealCategory: 'REPORT_RESULT',
        subject: '신고 처리 결과 문의',
        body: '상세 내용은 ticket detail에만 남아야 합니다.',
        emailReplyConsent: true,
      })
      .expect(201);

    const createBody = createResponse.body as SupportTicketResponseBody;
    const ticket = createBody.ticket;
    expect(ticket).toMatchObject({ status: 'OPEN' });
    expect(await prisma.supportTicketMessage.count({ where: { ticketId: ticket.id } })).toBe(1);
    expect(await prisma.userNotification.count({ where: { sourceId: ticket.id } })).toBe(1);
    expect(await prisma.notificationOutboxEvent.count()).toBe(1);

    const listResponse = await request(httpServer)
      .get('/api/support/tickets')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
    const listBody = listResponse.body as SupportTicketListResponseBody;
    expect(listBody.items).toHaveLength(1);

    const detailResponse = await request(httpServer)
      .get(`/api/support/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
    const detailBody = detailResponse.body as SupportTicketDetailResponseBody;
    expect(detailBody.messages[0]).toMatchObject({
      senderType: 'USER',
      body: '상세 내용은 ticket detail에만 남아야 합니다.',
    });

    await request(httpServer)
      .get(`/api/support/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(404);

    const replyResponse = await request(httpServer)
      .post(`/api/support/tickets/${ticket.id}/messages`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ body: '추가 설명입니다.' })
      .expect(201);
    const replyBody = replyResponse.body as SupportTicketResponseBody;
    expect(replyBody.ticket.status).toBe('WAITING_OPERATOR');
  });

  it('operations support API는 일반 self-service token으로 fail-closed 한다', async () => {
    const userAToken = await issueAccessToken('user-a', 'user-a@kangwon.ac.kr');

    await request(httpServer)
      .get('/api/operations/support/tickets')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(403);
  });

  it('FAQ API는 published article만 반환한다', async () => {
    await prisma.supportFaqArticle.createMany({
      data: [
        {
          id: 'faq-public',
          category: 'OTHER',
          question: '공개 질문',
          answer: '공개 답변',
          published: true,
          sortOrder: 1,
        },
        {
          id: 'faq-hidden',
          category: 'OTHER',
          question: '비공개 질문',
          answer: '비공개 답변',
          published: false,
          sortOrder: 2,
        },
      ],
    });

    const listResponse = await request(httpServer).get('/api/support/faq').expect(200);
    const listBody = listResponse.body as SupportFaqListResponseBody;
    expect(listBody.items).toEqual([
      expect.objectContaining({ id: 'faq-public', question: '공개 질문' }),
    ]);

    await request(httpServer).get('/api/support/faq/faq-hidden').expect(404);
  });
});

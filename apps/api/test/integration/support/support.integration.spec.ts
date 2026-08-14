import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { AuthSessionService } from '../../../src/auth/sessions/auth-session.service.js';
import { SupportService } from '../../../src/support/application/support.service.js';
import { seedBaseSeasonFixtures } from '../_support/fixtures/reference-data.fixture.js';
import { seedRegisteredAssignedParticipant } from '../_support/fixtures/participants.fixture.js';
import { useIntegrationTestSuite } from '../_support/integration-suite.js';

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
  const suite = useIntegrationTestSuite('support_integration');

  function httpServer() {
    return suite.app.getHttpServer() as Parameters<typeof request>[0];
  }

  function authSessionService() {
    return suite.app.get(AuthSessionService);
  }

  function supportService() {
    return suite.app.get(SupportService);
  }

  beforeEach(async () => {
    await seedBaseSeasonFixtures(suite.prisma);
    await seedRegisteredAssignedParticipant(suite.prisma, {
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저가',
    });
    await seedRegisteredAssignedParticipant(suite.prisma, {
      userId: 'user-b',
      participantId: 'participant-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '유저나',
    });
  });

  async function issueAccessToken(userId: string, email: string) {
    const issued = await authSessionService().issueAuthResult(userId, email, false);
    return issued.accessToken;
  }

  it('사용자는 support ticket을 생성하고 본인 ticket만 list/detail/reply할 수 있다', async () => {
    const userAToken = await issueAccessToken('user-a', 'user-a@kangwon.ac.kr');
    const userBToken = await issueAccessToken('user-b', 'user-b@kangwon.ac.kr');

    const createResponse = await request(httpServer())
      .post('/api/support/tickets')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        category: 'APPEAL',
        appealCategory: 'SANCTION',
        subject: '신고 처리 결과 문의',
        body: '상세 내용은 ticket detail에만 남아야 합니다.',
        emailReplyConsent: true,
      })
      .expect(201);

    const createBody = createResponse.body as SupportTicketResponseBody;
    const ticket = createBody.ticket;
    expect(ticket).toMatchObject({ status: 'OPEN' });
    expect(await suite.prisma.supportTicketMessage.count({ where: { ticketId: ticket.id } })).toBe(
      1,
    );
    expect(await suite.prisma.userNotification.count({ where: { sourceId: ticket.id } })).toBe(1);
    expect(await suite.prisma.notificationOutboxEvent.count()).toBe(1);

    const listResponse = await request(httpServer())
      .get('/api/support/tickets')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
    const listBody = listResponse.body as SupportTicketListResponseBody;
    expect(listBody.items).toHaveLength(1);

    const detailResponse = await request(httpServer())
      .get(`/api/support/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
    const detailBody = detailResponse.body as SupportTicketDetailResponseBody;
    expect(detailBody.messages[0]).toMatchObject({
      senderType: 'USER',
      body: '상세 내용은 ticket detail에만 남아야 합니다.',
    });

    await request(httpServer())
      .get(`/api/support/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(404);

    const replyResponse = await request(httpServer())
      .post(`/api/support/tickets/${ticket.id}/messages`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ body: '추가 설명입니다.' })
      .expect(201);
    const replyBody = replyResponse.body as SupportTicketResponseBody;
    expect(replyBody.ticket.status).toBe('WAITING_OPERATOR');
  });

  it('user preflight 후 operator가 ticket을 close하면 stale append는 최신 status로 fail-closed 한다', async () => {
    const userAToken = await issueAccessToken('user-a', 'user-a@kangwon.ac.kr');

    const createResponse = await request(httpServer())
      .post('/api/support/tickets')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        category: 'BUG',
        subject: 'stale append 문의',
        body: '닫히기 전 사용자가 본 문의입니다.',
        emailReplyConsent: false,
      })
      .expect(201);
    const createBody = createResponse.body as SupportTicketResponseBody;
    const ticketId = createBody.ticket.id;

    await request(httpServer())
      .get(`/api/support/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    await supportService().resolveAsOperator(
      { id: 'user-b', gender: 'F', campus: 'CHUNCHEON' },
      ticketId,
      { status: 'CLOSED' },
    );

    await request(httpServer())
      .post(`/api/support/tickets/${ticketId}/messages`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ body: 'preflight 이후 stale follow-up입니다.' })
      .expect(409)
      .expect((response) => {
        expect(response.body).toMatchObject({ code: 'SUPPORT_TICKET_CLOSED' });
      });

    await expect(suite.prisma.supportTicketMessage.count({ where: { ticketId } })).resolves.toBe(1);
    const closedTicket = await suite.prisma.supportTicket.findUniqueOrThrow({
      where: { id: ticketId },
      select: { status: true, closedAt: true },
    });
    expect(closedTicket.status).toBe('CLOSED');
    expect(closedTicket.closedAt).toBeInstanceOf(Date);
    await expect(
      suite.prisma.userNotification.count({ where: { sourceId: ticketId } }),
    ).resolves.toBe(2);
    await expect(
      suite.prisma.notificationOutboxEvent.count({
        where: { notification: { sourceId: ticketId } },
      }),
    ).resolves.toBe(2);
  });

  it('operations support API는 일반 self-service token으로 fail-closed 한다', async () => {
    const userAToken = await issueAccessToken('user-a', 'user-a@kangwon.ac.kr');

    await request(httpServer())
      .get('/api/operations/support/tickets')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(403);
  });

  it('FAQ API는 Support Center에 배치된 published article만 반환한다', async () => {
    await suite.prisma.supportFaqArticle.createMany({
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
        {
          id: 'faq-unplaced',
          category: 'OTHER',
          question: '미배치 질문',
          answer: '미배치 답변',
          published: true,
          sortOrder: 3,
        },
      ],
    });
    await suite.prisma.supportFaqPlacement.createMany({
      data: [
        {
          articleId: 'faq-public',
          surface: 'SUPPORT_CENTER',
          sortOrder: 1,
        },
        {
          articleId: 'faq-hidden',
          surface: 'SUPPORT_CENTER',
          sortOrder: 2,
        },
      ],
    });

    const listResponse = await request(httpServer()).get('/api/support/faq').expect(200);
    const listBody = listResponse.body as SupportFaqListResponseBody;
    expect(listBody.items).toEqual([
      expect.objectContaining({ id: 'faq-public', question: '공개 질문' }),
    ]);

    await request(httpServer()).get('/api/support/faq/faq-hidden').expect(404);
    await request(httpServer()).get('/api/support/faq/faq-unplaced').expect(404);
  });

  it('FAQ API는 Support Center placement 순서와 category filter를 적용한다', async () => {
    await suite.prisma.supportFaqArticle.createMany({
      data: [
        {
          id: 'faq-support-second',
          category: 'OTHER',
          question: '지원센터 두 번째 질문',
          answer: '지원센터 두 번째 답변',
          published: true,
          sortOrder: 200,
        },
        {
          id: 'faq-support-first',
          category: 'SEASON',
          question: '지원센터 첫 번째 질문',
          answer: '지원센터 첫 번째 답변',
          published: true,
          sortOrder: 100,
        },
        {
          id: 'faq-unplaced',
          category: 'OTHER',
          question: '미배치 질문',
          answer: '미배치 답변',
          published: true,
          sortOrder: 1,
        },
        {
          id: 'faq-support-hidden',
          category: 'OTHER',
          question: '비공개 지원센터 질문',
          answer: '비공개 지원센터 답변',
          published: false,
          sortOrder: 1,
        },
      ],
    });
    await suite.prisma.supportFaqPlacement.createMany({
      data: [
        {
          articleId: 'faq-support-second',
          surface: 'SUPPORT_CENTER',
          sortOrder: 20,
        },
        {
          articleId: 'faq-support-first',
          surface: 'SUPPORT_CENTER',
          sortOrder: 10,
        },
        {
          articleId: 'faq-support-hidden',
          surface: 'SUPPORT_CENTER',
          sortOrder: 1,
        },
      ],
    });

    const listResponse = await request(httpServer()).get('/api/support/faq').expect(200);
    const listBody = listResponse.body as SupportFaqListResponseBody;
    expect(listBody.items).toEqual([
      expect.objectContaining({ id: 'faq-support-first' }),
      expect.objectContaining({ id: 'faq-support-second' }),
    ]);

    const filteredResponse = await request(httpServer())
      .get('/api/support/faq?category=OTHER')
      .expect(200);
    const filteredBody = filteredResponse.body as SupportFaqListResponseBody;
    expect(filteredBody.items).toEqual([
      expect.objectContaining({
        id: 'faq-support-second',
        question: '지원센터 두 번째 질문',
      }),
    ]);
  });
});

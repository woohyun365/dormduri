import request from 'supertest';
import { AuthSessionService } from '../../src/auth/auth-session.service.js';
import { ChatService } from '../../src/chat/chat.service.js';
import { PrismaService } from '../../src/common/prisma/prisma.service.js';
import { createIntegrationApp } from './support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from './support/integration-db.js';
import {
  authContext,
  seedBaseSeasonFixtures,
  seedRegisteredAssignedParticipant,
} from './support/integration-fixtures.js';

type SendConversationMessageRequest = {
  targetUserId: string;
  body: string;
  clientMessageId: string;
};

type NotificationListBody = {
  items: Array<{
    id: string;
    recipientUserId: string;
    actorUserId: string;
    kind: string;
    readAt: string | null;
  }>;
  pageInfo: {
    hasNextPage: boolean;
    nextCursor: string | null;
  };
};

type MarkNotificationReadBody = {
  notification: {
    id: string;
    readAt: string | null;
  };
};

function makeSendMessageInput(
  body: string,
  clientMessageId: string,
  targetUserId = 'user-b',
): SendConversationMessageRequest {
  return { targetUserId, body, clientMessageId };
}

describe('Notifications integration', () => {
  jest.setTimeout(60_000);

  let prisma: PrismaService;
  let chatService: ChatService;
  let authSessionService: AuthSessionService;
  let httpServer: Parameters<typeof request>[0];
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const sandbox = await createIntegrationDatabaseSandbox('notifications_integration');
    cleanupDb = sandbox.cleanup;

    const { app, prisma: prismaService } = await createIntegrationApp();
    closeApp = () => app.close();
    httpServer = app.getHttpServer() as Parameters<typeof request>[0];
    prisma = prismaService;
    chatService = app.get(ChatService);
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

  it('첫 direct 메시지는 recipient 알림과 notification outbox를 생성하고 sender에게는 만들지 않는다', async () => {
    await chatService.sendMessage(
      authContext('user-a'),
      makeSendMessageInput('알림에 저장되면 안 되는 원문', 'notification-first-direct'),
    );

    const notifications = await prisma.userNotification.findMany({
      orderBy: { createdAt: 'asc' },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      recipientUserId: 'user-b',
      actorUserId: 'user-a',
      kind: 'CHAT_THREAD_CREATED',
      sourceType: 'CONVERSATION_THREAD',
    });

    const serializedPayload = JSON.stringify(notifications[0]?.payload);
    expect(serializedPayload).toContain('threadId');
    expect(serializedPayload).not.toContain('알림에 저장되면 안 되는 원문');
    expect(serializedPayload).not.toContain('유저A');
    expect(serializedPayload).not.toContain('user-a@kangwon.ac.kr');

    const outbox = await prisma.notificationOutboxEvent.findMany();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      notificationId: notifications[0]?.id,
      recipientUserId: 'user-b',
      eventType: 'notification.created',
      status: 'PENDING',
    });
  });

  it('duplicate clientMessageId retry는 notification을 중복 생성하지 않는다', async () => {
    const input = makeSendMessageInput('같은 논리 전송', 'notification-idempotent-direct');
    await chatService.sendMessage(authContext('user-a'), input);
    await chatService.sendMessage(authContext('user-a'), input);

    expect(await prisma.userNotification.count()).toBe(1);
    expect(await prisma.notificationOutboxEvent.count()).toBe(1);
  });

  it('동시 duplicate clientMessageId retry도 notification을 중복 생성하지 않는다', async () => {
    const input = makeSendMessageInput('동시 같은 논리 전송', 'notification-idempotent-race');

    const results = await Promise.all([
      chatService.sendMessage(authContext('user-a'), input),
      chatService.sendMessage(authContext('user-a'), input),
    ]);

    expect(results[0]?.message.id).toBe(results[1]?.message.id);
    expect(await prisma.userNotification.count()).toBe(1);
    expect(await prisma.notificationOutboxEvent.count()).toBe(1);
  });

  it('send policy rejection은 notification과 outbox ghost row를 남기지 않는다', async () => {
    await prisma.seasonParticipant.update({
      where: { id: 'participant-a' },
      data: {
        dormitoryId: null,
        dormitorySelectionState: 'UNASSIGNED',
      },
    });

    await expect(
      chatService.sendMessage(
        authContext('user-a'),
        makeSendMessageInput('정책 거절 시 알림 생성 금지', 'notification-policy-reject'),
      ),
    ).rejects.toMatchObject({
      response: { code: 'CHAT_MESSAGE_SEND_NOT_ALLOWED' },
    });

    expect(await prisma.conversationThread.count()).toBe(0);
    expect(await prisma.userNotification.count()).toBe(0);
    expect(await prisma.notificationOutboxEvent.count()).toBe(0);
  });

  it('notification list와 mark-read는 authenticated recipient scope로 동작한다', async () => {
    await chatService.sendMessage(
      authContext('user-a'),
      makeSendMessageInput('목록 조회 대상', 'notification-list-direct'),
    );
    const userBToken = await issueAccessToken('user-b', 'user-b@kangwon.ac.kr');
    const userAToken = await issueAccessToken('user-a', 'user-a@kangwon.ac.kr');

    const senderList = await request(httpServer)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${userAToken}`);
    expect(senderList.status).toBe(200);
    expect(senderList.body).toMatchObject({ items: [] });

    const recipientList = await request(httpServer)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${userBToken}`);
    const recipientListBody = recipientList.body as NotificationListBody;
    expect(recipientList.status).toBe(200);
    expect(recipientListBody).toMatchObject({
      items: [
        expect.objectContaining({
          recipientUserId: 'user-b',
          actorUserId: 'user-a',
          kind: 'CHAT_THREAD_CREATED',
          readAt: null,
        }),
      ],
      pageInfo: { hasNextPage: false, nextCursor: null },
    });

    const notificationId = recipientListBody.items[0]?.id;
    expect(notificationId).toEqual(expect.any(String));
    if (!notificationId) {
      throw new Error('Expected notification id');
    }

    const senderMarkRead = await request(httpServer)
      .post(`/api/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(senderMarkRead.status).toBe(404);
    expect(senderMarkRead.body).toMatchObject({ code: 'NOTIFICATION_NOT_FOUND' });
    const stillUnread = await prisma.userNotification.findUniqueOrThrow({
      where: { id: notificationId },
      select: { readAt: true },
    });
    expect(stillUnread.readAt).toBeNull();

    const unreadBefore = await request(httpServer)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${userBToken}`);
    expect(unreadBefore.body).toEqual({ unreadCount: 1 });

    const marked = await request(httpServer)
      .post(`/api/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${userBToken}`);
    const markedBody = marked.body as MarkNotificationReadBody;
    expect(marked.status).toBe(201);
    expect(markedBody.notification.id).toBe(notificationId);
    expect(typeof markedBody.notification.readAt).toBe('string');

    const unreadAfter = await request(httpServer)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${userBToken}`);
    expect(unreadAfter.body).toEqual({ unreadCount: 0 });
  });
});

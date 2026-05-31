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

describe('ChatService integration', () => {
  jest.setTimeout(60_000);

  let prisma: PrismaService;
  let service: ChatService;
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const sandbox = await createIntegrationDatabaseSandbox('chat_integration');
    cleanupDb = sandbox.cleanup;

    const { app, prisma: prismaService } = await createIntegrationApp();
    closeApp = () => app.close();
    prisma = prismaService;
    service = app.get(ChatService);
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

  it('동시에 같은 pair로 첫 메시지를 보내도 thread는 하나만 생성되고 두 메시지가 남는다', async () => {
    const first = service.sendMessage(authContext('user-a'), {
      targetUserId: 'user-b',
      body: '첫 번째 메시지',
    });
    const second = service.sendMessage(authContext('user-a'), {
      targetUserId: 'user-b',
      body: '두 번째 메시지',
    });

    const results = await Promise.all([first, second]);

    expect(results[0]?.thread.id).toBe(results[1]?.thread.id);

    const threads = await prisma.conversationThread.findMany({
      where: {
        seasonId: 'season-integration',
        pairKey: 'participant-a:participant-b',
      },
    });
    expect(threads).toHaveLength(1);

    const messages = await prisma.conversationMessage.findMany({
      where: {
        threadId: threads[0]?.id,
      },
      orderBy: [{ sentAt: 'asc' }, { createdAt: 'asc' }],
    });

    expect(messages).toHaveLength(2);
    expect(messages.map((message) => message.body)).toEqual(
      expect.arrayContaining(['첫 번째 메시지', '두 번째 메시지']),
    );
  });

  it('direct thread에서 양쪽 leave race가 걸려도 최종 상태는 ARCHIVED다', async () => {
    await prisma.conversationThread.create({
      data: {
        id: 'direct-chat-race-thread',
        seasonId: 'season-integration',
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
        { threadId: 'direct-chat-race-thread', participantId: 'participant-a' },
        { threadId: 'direct-chat-race-thread', participantId: 'participant-b' },
      ],
    });

    const settled = await Promise.allSettled([
      service.leaveThread(authContext('user-a'), 'direct-chat-race-thread'),
      service.leaveThread(authContext('user-b'), 'direct-chat-race-thread'),
    ]);

    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(2);

    const thread = await prisma.conversationThread.findUnique({
      where: { id: 'direct-chat-race-thread' },
    });
    expect(thread?.threadKind).toBe('DIRECT');
    expect(thread?.status).toBe('ARCHIVED');

    const members = await prisma.conversationThreadMember.findMany({
      where: { threadId: 'direct-chat-race-thread' },
    });
    expect(members.every((member) => member.memberState === 'LEFT')).toBe(true);
  });
});

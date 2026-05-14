import {
  conversationMessageTombstoneText,
  createConversationRetainedBodyCipher,
  decryptConversationBodyPayload,
  discloseRetainedConversationMessageBody,
  encryptConversationBodyPayload,
  retainAndTombstoneThreadMessagesTx,
  tombstoneConversationMessageTx,
} from './conversation-retained-body-owner.js';

describe('conversation retained body owner', () => {
  const cipher = createConversationRetainedBodyCipher({
    key: Buffer.alloc(32, 7),
    keyVersion: 'test-v1',
  });

  function createMessageTx(
    initial?: Partial<{
      id: string;
      threadId: string;
      body: string;
      bodyState: 'PLAIN' | 'TOMBSTONED' | 'DISPOSED';
      bodyVersion: number;
    }>,
  ) {
    const message = {
      id: initial?.id ?? 'message-1',
      threadId: initial?.threadId ?? 'thread-1',
      body: initial?.body ?? '원문 메시지',
      bodyState: initial?.bodyState ?? 'PLAIN',
      tombstoneReason: null as string | null,
      tombstonedAt: null as Date | null,
      bodyRetainedAt: null as Date | null,
      bodyVersion: initial?.bodyVersion ?? 1,
      retainedBody: null as { id: string } | null,
    };
    const retainedBodies: unknown[] = [];

    return {
      message,
      retainedBodies,
      tx: {
        conversationMessage: {
          findMany: jest.fn().mockResolvedValue([message]),
          findUnique: jest.fn().mockResolvedValue(message),
          update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
            if (typeof data.body === 'string') message.body = data.body;
            if (typeof data.bodyState === 'string') message.bodyState = data.bodyState as never;
            if (typeof data.tombstoneReason === 'string') {
              message.tombstoneReason = data.tombstoneReason;
            }
            if (data.tombstonedAt instanceof Date) message.tombstonedAt = data.tombstonedAt;
            if (data.bodyRetainedAt instanceof Date) message.bodyRetainedAt = data.bodyRetainedAt;
            if (typeof data.bodyVersion === 'object' && data.bodyVersion) {
              message.bodyVersion += (data.bodyVersion as { increment: number }).increment;
            }
            return Promise.resolve({
              id: message.id,
              threadId: message.threadId,
              body: message.body,
              bodyVersion: message.bodyVersion,
            });
          }),
        },
        conversationMessageRetainedBody: {
          upsert: jest
            .fn()
            .mockImplementation(({ create }: { create: Record<string, unknown> }) => {
              retainedBodies.push(create);
              message.retainedBody = { id: 'retained-body-1' };
              return Promise.resolve(create);
            }),
        },
      },
    };
  }

  it('PLAIN message body를 암호화 vault에 저장하고 tombstone으로 치환한다', async () => {
    const now = new Date('2026-05-14T00:00:00.000Z');
    const store = createMessageTx({ body: '신고 대응에 필요할 수 있는 원문' });

    const result = await retainAndTombstoneThreadMessagesTx(
      store.tx as never,
      {
        threadId: 'thread-1',
        archiveJobId: 'archive-job-1',
        triggerRetainedIdentityId: 'retained-identity-1',
        now,
      },
      { bodyCipher: cipher },
    );

    expect(result).toMatchObject({ scannedCount: 1, retainedCount: 1, tombstonedCount: 1 });
    expect(store.message).toMatchObject({
      body: conversationMessageTombstoneText.ACCOUNT_DELETION_RETENTION,
      bodyState: 'TOMBSTONED',
      tombstoneReason: 'ACCOUNT_DELETION_RETENTION',
      bodyVersion: 2,
      bodyRetainedAt: now,
    });
    expect(store.retainedBodies).toHaveLength(1);
    const retainedBody = store.retainedBodies[0] as {
      encryptedBodyPayload: unknown;
      bodyDigest: string;
      keyVersion: string;
    };
    expect(retainedBody.bodyDigest).toHaveLength(64);
    expect(retainedBody.keyVersion).toBe('test-v1');
    expect(decryptConversationBodyPayload(cipher, retainedBody.encryptedBodyPayload)).toMatchObject(
      {
        messageId: 'message-1',
        threadId: 'thread-1',
        body: '신고 대응에 필요할 수 있는 원문',
      },
    );
    expect(result.events[0]).toMatchObject({
      type: 'conversation.message.tombstoned',
      messageId: 'message-1',
      bodyState: 'TOMBSTONED',
      tombstoneReason: 'ACCOUNT_DELETION_RETENTION',
      body: conversationMessageTombstoneText.ACCOUNT_DELETION_RETENTION,
      bodyVersion: 2,
    });
  });

  it('사용자 메시지 삭제 tombstone은 원문 보존 없이 처리할 수 있다', async () => {
    const now = new Date('2026-05-14T00:00:00.000Z');
    const store = createMessageTx({ body: '사용자가 삭제할 메시지' });

    const event = await tombstoneConversationMessageTx(store.tx as never, {
      messageId: 'message-1',
      reason: 'USER_MESSAGE_DELETED',
      now,
      retainOriginalBody: false,
    });

    expect(store.retainedBodies).toHaveLength(0);
    expect(event).toMatchObject({
      tombstoneReason: 'USER_MESSAGE_DELETED',
      body: conversationMessageTombstoneText.USER_MESSAGE_DELETED,
    });
  });

  it('retained body 복원은 승인 근거와 접근 로그를 남긴다', async () => {
    const encryptedBodyPayload = encryptConversationBodyPayload(cipher, {
      schemaVersion: 1,
      messageId: 'message-1',
      threadId: 'thread-1',
      body: '복원 대상 원문',
      retainedAt: '2026-05-14T00:00:00.000Z',
    });
    const logs: unknown[] = [];
    const prisma = {
      conversationMessageRetainedBody: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'retained-body-1',
          messageId: 'message-1',
          threadId: 'thread-1',
          encryptedBodyPayload,
          disposedAt: null,
        }),
      },
      conversationMessageRetainedBodyAccessLog: {
        create: jest.fn().mockImplementation((input: unknown) => {
          logs.push(input);
          return Promise.resolve(input);
        }),
      },
    };

    const disclosure = await discloseRetainedConversationMessageBody(
      prisma as never,
      {
        retainedBodyId: 'retained-body-1',
        accessedBy: 'ops-1',
        accessReason: 'REPORT_REVIEW',
        approvalReference: 'report-1',
        purpose: '신고 검토',
        now: new Date('2026-05-15T00:00:00.000Z'),
      },
      { bodyCipher: cipher },
    );

    expect(disclosure).toMatchObject({
      retainedBodyId: 'retained-body-1',
      messageId: 'message-1',
      threadId: 'thread-1',
      body: '복원 대상 원문',
      keyVersion: 'test-v1',
    });
    expect(logs[0]).toMatchObject({
      data: {
        retainedBodyId: 'retained-body-1',
        accessReason: 'REPORT_REVIEW',
        approvalReference: 'report-1',
        result: 'DISCLOSED',
        disclosedFields: ['body'],
      },
    });
  });
});

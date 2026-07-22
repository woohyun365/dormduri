import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatApiError, chatApi } from '../chat.api';

const thread = {
  id: 'thread-1',
  seasonId: 'season-1',
  counterpartUserId: 'counterpart-1',
  counterpartParticipantId: 'participant-1',
  threadKind: 'MATCHED',
  status: 'OPEN',
  closedReason: null,
  closedAt: null,
  lastMessageAt: '2026-07-15T10:00:00.000Z',
  canSendMessage: true,
  sendMessageUnavailableReason: null,
  canReport: true,
};

function stubFetch(body: unknown, init: ResponseInit = {}) {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('chatApi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('owner cursor를 그대로 전달하고 shared thread schema만 수용한다', async () => {
    const fetchMock = stubFetch({
      items: [thread],
      pageInfo: { hasNextPage: true, nextCursor: 'cursor-2' },
    });

    await expect(chatApi.getThreads({ cursor: 'cursor 1/2', limit: 20 })).resolves.toMatchObject({
      pageInfo: { nextCursor: 'cursor-2' },
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/chat/threads?cursor=cursor+1%2F2&limit=20', {
      method: 'GET',
      headers: undefined,
      cache: 'no-store',
      signal: undefined,
    });
  });

  it('시즌별 대화 상대 통계는 chat owner endpoint와 strict schema를 사용한다', async () => {
    const fetchMock = stubFetch({
      current: null,
      past: [{ seasonId: 'season-1', seasonName: '2026년 1학기', conversationUserCount: 4 }],
    });

    await expect(chatApi.getConversationStats()).resolves.toMatchObject({
      past: [{ seasonId: 'season-1', conversationUserCount: 4 }],
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/chat/conversation-stats', {
      method: 'GET',
      headers: undefined,
      cache: 'no-store',
      signal: undefined,
    });
  });

  it('chat thread 신고는 social-safety owner endpoint와 strict request/response schema를 사용한다', async () => {
    const fetchMock = stubFetch({
      report: {
        id: 'report-1',
        targetType: 'CHAT_THREAD',
        reason: 'THREAT',
        receivedAt: '2026-07-15T10:00:00.000Z',
        status: 'RECEIVED',
      },
      received: true,
      optionalActionResult: null,
    });

    await expect(
      chatApi.createReport({
        targetType: 'CHAT_THREAD',
        targetId: 'thread-1',
        reason: 'THREAT',
        detail: null,
        evidenceAttachmentIds: [],
        optionalAction: null,
        falseReportDisclaimerAccepted: true,
      }),
    ).resolves.toMatchObject({ received: true });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/reports',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('schema drift와 upstream 오류를 안전한 ChatApiError로 닫는다', async () => {
    stubFetch({ items: [{ id: 'broken' }], pageInfo: { hasNextPage: false, nextCursor: null } });
    await expect(chatApi.getThreads()).rejects.toMatchObject({
      code: 'CHAT_API_RESPONSE_INVALID',
    } satisfies Partial<ChatApiError>);

    vi.unstubAllGlobals();
    stubFetch({ message: 'upstream internal detail' }, { status: 500 });
    await expect(chatApi.getThreads()).rejects.toMatchObject({
      code: 'CHAT_API_NETWORK',
    } satisfies Partial<ChatApiError>);
  });
});

import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createBffRequest as createRequest,
  firstFetchInit,
  firstFetchInput,
  stubJsonFetch,
} from '../../../test/bff-route';
import { GET as getThreads } from '../chat/threads/route';
import { GET as getThreadDetail } from '../chat/threads/[id]/route';
import { POST as updateReadMarker } from '../chat/threads/[id]/read-marker/route';
import { POST as sendMessage } from '../chat/messages/route';
import { POST as leaveThread } from '../chat/threads/[id]/leave/route';

const AUTH_TOKEN = `v1.session-chat.${'a'.repeat(43)}`;
const chatBffRoot = join(process.cwd(), 'src/app/api/chat');

function chatBffRouteFiles(root = chatBffRoot): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return chatBffRouteFiles(path);
    return entry.isFile() && entry.name === 'route.ts' ? [relative(chatBffRoot, path)] : [];
  });
}
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
} as const;

describe('chat BFF forwarding routes', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('chat owner route allowlist 밖의 matching/group BFF surface를 만들지 않는다', () => {
    expect(existsSync(join(chatBffRoot, 'groups'))).toBe(false);
    expect(chatBffRouteFiles().sort()).toEqual([
      'conversation-stats/route.ts',
      'messages/route.ts',
      'threads/[id]/leave/route.ts',
      'threads/[id]/read-marker/route.ts',
      'threads/[id]/route.ts',
      'threads/route.ts',
    ]);
  });

  it('thread list는 cookie 인증, cursor query, strict shared response를 그대로 사용한다', async () => {
    const fetchMock = stubJsonFetch({
      items: [thread],
      pageInfo: { hasNextPage: true, nextCursor: 'cursor-2' },
    });
    const response = await getThreads(
      createRequest('/api/chat/threads?cursor=cursor-1&limit=20', {
        headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
      }),
    );

    expect(response.status).toBe(200);
    expect(firstFetchInput(fetchMock)).toBe(
      'http://localhost:4000/api/chat/threads?cursor=cursor-1&limit=20',
    );
    expect(firstFetchInit(fetchMock)).toEqual(
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        headers: expect.objectContaining({ Authorization: `Bearer ${AUTH_TOKEN}` }),
      }),
    );
  });

  it('detail/read marker/leave는 encoded thread id와 owner response schema를 사용한다', async () => {
    const context = { params: Promise.resolve({ id: 'thread 1/2' }) };
    const detailFetch = stubJsonFetch({ thread, messages: [] });
    await getThreadDetail(
      createRequest('/api/chat/threads/thread%201%2F2', {
        headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
      }),
      context,
    );
    expect(firstFetchInput(detailFetch)).toBe(
      'http://localhost:4000/api/chat/threads/thread%201%2F2',
    );

    vi.unstubAllGlobals();
    const readFetch = stubJsonFetch({
      threadId: 'thread 1/2',
      lastReadMessageId: 'message-1',
      lastReadAt: '2026-07-15T10:01:00.000Z',
    });
    await updateReadMarker(
      createRequest('/api/chat/threads/thread%201%2F2/read-marker', {
        method: 'POST',
        headers: { Cookie: `auth-token=${AUTH_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastReadMessageId: 'message-1' }),
      }),
      context,
    );
    expect(firstFetchInput(readFetch)).toBe(
      'http://localhost:4000/api/chat/threads/thread%201%2F2/read-marker',
    );

    vi.unstubAllGlobals();
    const leaveFetch = stubJsonFetch({ threadId: 'thread 1/2', archived: false });
    await leaveThread(
      createRequest('/api/chat/threads/thread%201%2F2/leave', {
        method: 'POST',
        headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
      }),
      context,
    );
    expect(firstFetchInput(leaveFetch)).toBe(
      'http://localhost:4000/api/chat/threads/thread%201%2F2/leave',
    );
  });

  it('message success schema drift와 malformed body를 fail-closed 처리한다', async () => {
    stubJsonFetch({ thread: { id: 'thread-1' } });
    const response = await sendMessage(
      createRequest('/api/chat/messages', {
        method: 'POST',
        headers: { Cookie: `auth-token=${AUTH_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: 'counterpart-1',
          body: '안녕하세요',
          clientMessageId: 'message-1',
        }),
      }),
    );
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ code: 'BFF_UPSTREAM_SCHEMA_INVALID' });

    vi.unstubAllGlobals();
    const invalidResponse = await updateReadMarker(
      createRequest('/api/chat/threads/thread-1/read-marker', { method: 'POST', body: '{' }),
      { params: Promise.resolve({ id: 'thread-1' }) },
    );
    expect(invalidResponse.status).toBe(400);
    await expect(invalidResponse.json()).resolves.toMatchObject({
      code: 'BFF_REQUEST_BODY_INVALID',
    });
  });
});

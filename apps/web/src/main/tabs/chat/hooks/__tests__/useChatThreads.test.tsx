import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ConversationThreadListResponse } from '@repo/shared/chat';
import { useChatThreads } from '../useChatThreads';

function page(id: string, nextCursor: string | null): ConversationThreadListResponse {
  return {
    items: [
      {
        id,
        seasonId: 'season-1',
        counterpartUserId: `counterpart-${id}`,
        counterpartParticipantId: `participant-${id}`,
        threadKind: 'MATCHED',
        status: 'OPEN',
        closedReason: null,
        closedAt: null,
        lastMessageAt: null,
        canSendMessage: true,
        sendMessageUnavailableReason: null,
        canReport: true,
      },
    ],
    pageInfo: { hasNextPage: nextCursor !== null, nextCursor },
  };
}

describe('useChatThreads', () => {
  it('owner nextCursor만 전달해 다음 page를 누적하고 refresh 시 stale page를 폐기한다', async () => {
    const client = {
      getThreads: vi
        .fn()
        .mockResolvedValueOnce(page('thread-1', 'cursor-2'))
        .mockResolvedValueOnce(page('thread-2', null))
        .mockResolvedValueOnce(page('thread-fresh', null)),
    };
    const { result } = renderHook(() => useChatThreads({ client }));

    await waitFor(() => expect(result.current.data?.items).toHaveLength(1));
    await act(async () => result.current.loadMore());
    expect(client.getThreads).toHaveBeenNthCalledWith(
      2,
      { cursor: 'cursor-2' },
      expect.any(AbortSignal),
    );
    expect(result.current.data?.items.map((item) => item.id)).toEqual(['thread-1', 'thread-2']);

    await act(async () => result.current.refresh());
    expect(result.current.data?.items.map((item) => item.id)).toEqual(['thread-fresh']);
  });
});

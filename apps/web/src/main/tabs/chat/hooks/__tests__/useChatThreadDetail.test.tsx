import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ConversationThreadDetailResponse } from '@repo/shared/chat';
import { useChatThreadDetail } from '../useChatThreadDetail';

function detail(threadId: string): ConversationThreadDetailResponse {
  return {
    thread: {
      id: threadId,
      seasonId: 'season-1',
      counterpartUserId: `counterpart-${threadId}`,
      counterpartParticipantId: `participant-${threadId}`,
      threadKind: 'MATCHED',
      status: 'OPEN',
      closedReason: null,
      closedAt: null,
      lastMessageAt: null,
      canSendMessage: true,
      sendMessageUnavailableReason: null,
      canReport: true,
    },
    messages: [],
  };
}

describe('useChatThreadDetail thread boundary', () => {
  it('A에서 B로 전환한 뒤 늦게 도착한 A 응답을 노출하지 않는다', async () => {
    const resolvers = new Map<string, (value: ConversationThreadDetailResponse) => void>();
    const signals = new Map<string, AbortSignal>();
    const client = {
      getThreadDetail: vi.fn((threadId: string, signal?: AbortSignal) => {
        if (signal) signals.set(threadId, signal);
        return new Promise<ConversationThreadDetailResponse>((resolve) => {
          resolvers.set(threadId, resolve);
        });
      }),
    };
    const { result, rerender } = renderHook(
      ({ threadId }) => useChatThreadDetail(threadId, { client }),
      { initialProps: { threadId: 'thread-a' as string | null } },
    );

    await waitFor(() => expect(client.getThreadDetail).toHaveBeenCalledTimes(1));
    rerender({ threadId: 'thread-b' });
    await waitFor(() => expect(client.getThreadDetail).toHaveBeenCalledTimes(2));
    expect(signals.get('thread-a')?.aborted).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolvers.get('thread-b')?.(detail('thread-b'));
    });
    await waitFor(() => expect(result.current.data?.thread.id).toBe('thread-b'));

    await act(async () => {
      resolvers.get('thread-a')?.(detail('thread-a'));
    });
    expect(result.current.data?.thread.id).toBe('thread-b');
  });

  it('threadId가 null이 되면 pending detail을 abort하고 snapshot을 비운다', async () => {
    let resolveDetail: ((value: ConversationThreadDetailResponse) => void) | undefined;
    let signal: AbortSignal | undefined;
    const client = {
      getThreadDetail: vi.fn((_threadId: string, requestSignal?: AbortSignal) => {
        signal = requestSignal;
        return new Promise<ConversationThreadDetailResponse>((resolve) => {
          resolveDetail = resolve;
        });
      }),
    };
    const { result, rerender } = renderHook(
      ({ threadId }) => useChatThreadDetail(threadId, { client }),
      { initialProps: { threadId: 'thread-a' as string | null } },
    );

    await waitFor(() => expect(client.getThreadDetail).toHaveBeenCalledTimes(1));
    rerender({ threadId: null });

    expect(signal?.aborted).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);

    await act(async () => {
      resolveDetail?.(detail('thread-a'));
    });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});

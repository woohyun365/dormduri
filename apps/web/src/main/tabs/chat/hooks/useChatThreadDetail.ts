'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConversationThreadDetailResponse } from '@repo/shared/chat';
import { ChatApiError, chatApi } from '../api/chat.api';

export interface ChatThreadDetailClient {
  readonly getThreadDetail: (
    threadId: string,
    signal?: AbortSignal,
  ) => Promise<ConversationThreadDetailResponse>;
}

export function useChatThreadDetail(
  threadId: string | null,
  options: { client?: ChatThreadDetailClient } = {},
) {
  const client = options.client ?? chatApi;
  const abortRef = useRef<AbortController | null>(null);
  const sequenceRef = useRef(0);
  const [state, setState] = useState({
    threadId,
    data: null as ConversationThreadDetailResponse | null,
    error: null as ChatApiError | null,
    loading: threadId !== null,
  });

  const refresh = useCallback(async () => {
    if (!threadId) {
      setState({ threadId, data: null, error: null, loading: false });
      return;
    }
    const sequence = ++sequenceRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState((current) => ({
      threadId,
      data: current.threadId === threadId ? current.data : null,
      error: null,
      loading: true,
    }));
    try {
      const data = await client.getThreadDetail(threadId, controller.signal);
      if (!controller.signal.aborted && sequence === sequenceRef.current) {
        setState({ threadId, data, error: null, loading: false });
      }
    } catch (caught) {
      if (!controller.signal.aborted && sequence === sequenceRef.current) {
        setState({
          threadId,
          data: null,
          error: caught instanceof ChatApiError ? caught : new ChatApiError('CHAT_API_NETWORK'),
          loading: false,
        });
      }
    }
  }, [client, threadId]);

  useEffect(() => {
    void refresh();
    return () => {
      sequenceRef.current += 1;
      abortRef.current?.abort();
    };
  }, [refresh]);

  const current = state.threadId === threadId ? state : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: current?.loading ?? threadId !== null,
    refresh,
  };
}

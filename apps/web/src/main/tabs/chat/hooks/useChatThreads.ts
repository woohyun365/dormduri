'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConversationThreadListResponse } from '@repo/shared/chat';
import { ChatApiError, chatApi } from '../api/chat.api';

export interface ChatThreadsClient {
  readonly getThreads: (
    options?: { cursor?: string | null; limit?: number },
    signal?: AbortSignal,
  ) => Promise<ConversationThreadListResponse>;
}

export function useChatThreads(options: { client?: ChatThreadsClient; identityKey?: string } = {}) {
  const client = options.client ?? chatApi;
  const identityKey = options.identityKey ?? 'default';
  const abortRef = useRef<AbortController | null>(null);
  const loadMoreAbortRef = useRef<AbortController | null>(null);
  const sequenceRef = useRef(0);
  const [state, setState] = useState({
    identityKey,
    data: null as ConversationThreadListResponse | null,
    error: null as ChatApiError | null,
    loading: true,
    loadingMore: false,
    loadMoreError: null as ChatApiError | null,
  });

  const refresh = useCallback(async () => {
    const sequence = ++sequenceRef.current;
    abortRef.current?.abort();
    loadMoreAbortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState((current) => ({
      identityKey,
      data: current.identityKey === identityKey ? current.data : null,
      error: null,
      loading: true,
      loadingMore: false,
      loadMoreError: null,
    }));
    try {
      const data = await client.getThreads({}, controller.signal);
      if (!controller.signal.aborted && sequence === sequenceRef.current) {
        setState({
          identityKey,
          data,
          error: null,
          loading: false,
          loadingMore: false,
          loadMoreError: null,
        });
      }
    } catch (caught) {
      if (!controller.signal.aborted && sequence === sequenceRef.current) {
        setState({
          identityKey,
          data: null,
          error: caught instanceof ChatApiError ? caught : new ChatApiError('CHAT_API_NETWORK'),
          loading: false,
          loadingMore: false,
          loadMoreError: null,
        });
      }
    }
  }, [client, identityKey]);

  const loadMore = useCallback(async () => {
    const current = state.identityKey === identityKey ? state : null;
    const cursor = current?.data?.pageInfo.nextCursor;
    if (!cursor || current?.loading || current?.loadingMore) return;

    const sequence = sequenceRef.current;
    loadMoreAbortRef.current?.abort();
    const controller = new AbortController();
    loadMoreAbortRef.current = controller;
    setState((previous) =>
      previous.identityKey === identityKey
        ? { ...previous, error: null, loadMoreError: null, loadingMore: true }
        : previous,
    );
    try {
      const page = await client.getThreads({ cursor }, controller.signal);
      if (!controller.signal.aborted && sequence === sequenceRef.current) {
        setState((previous) => {
          if (previous.identityKey !== identityKey || !previous.data) return previous;
          return {
            ...previous,
            data: { items: [...previous.data.items, ...page.items], pageInfo: page.pageInfo },
            loadingMore: false,
          };
        });
      }
    } catch (caught) {
      if (!controller.signal.aborted && sequence === sequenceRef.current) {
        setState((previous) =>
          previous.identityKey === identityKey
            ? {
                ...previous,
                loadMoreError:
                  caught instanceof ChatApiError ? caught : new ChatApiError('CHAT_API_NETWORK'),
                loadingMore: false,
              }
            : previous,
        );
      }
    }
  }, [client, identityKey, state]);

  useEffect(() => {
    void refresh();
    return () => {
      sequenceRef.current += 1;
      abortRef.current?.abort();
      loadMoreAbortRef.current?.abort();
    };
  }, [refresh]);

  const current = state.identityKey === identityKey ? state : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: current?.loading ?? true,
    loadingMore: current?.loadingMore ?? false,
    loadMoreError: current?.loadMoreError ?? null,
    loadMore,
    refresh,
  };
}

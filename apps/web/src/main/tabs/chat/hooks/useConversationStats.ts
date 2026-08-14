'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConversationStatsResponse } from '@repo/shared/chat';
import { ChatApiError, chatApi } from '../api/chat.api';

export interface ConversationStatsClient {
  readonly getConversationStats: (signal?: AbortSignal) => Promise<ConversationStatsResponse>;
}

export function useConversationStats(
  options: { readonly client?: ConversationStatsClient; readonly identityKey?: string } = {},
) {
  const client = options.client ?? chatApi;
  const [data, setData] = useState<ConversationStatsResponse | null>(null);
  const [error, setError] = useState<ChatApiError | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const sequenceRef = useRef(0);

  useEffect(
    () => () => {
      sequenceRef.current += 1;
      abortRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    sequenceRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setData(null);
    setError(null);
    setLoading(false);
  }, [options.identityKey]);

  const load = useCallback(async () => {
    const sequence = sequenceRef.current + 1;
    sequenceRef.current = sequence;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const nextData = await client.getConversationStats(controller.signal);
      if (!controller.signal.aborted && sequenceRef.current === sequence) setData(nextData);
    } catch (caught) {
      if (!controller.signal.aborted && sequenceRef.current === sequence) {
        setError(caught instanceof ChatApiError ? caught : new ChatApiError('CHAT_API_NETWORK'));
      }
    } finally {
      if (!controller.signal.aborted && sequenceRef.current === sequence) setLoading(false);
    }
  }, [client]);

  return { data, error, loading, load };
}

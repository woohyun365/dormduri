import {
  conversationThreadDetailResponseSchema,
  conversationThreadListResponseSchema,
  leaveConversationThreadResponseSchema,
  sendConversationMessageRequestSchema,
  sendConversationMessageResponseSchema,
  updateChatReadMarkerRequestSchema,
  updateConversationReadMarkerResponseSchema,
  type ConversationThreadDetailResponse,
  type ConversationThreadListResponse,
  type LeaveConversationThreadResponse,
  type SendConversationMessageRequest,
  type SendConversationMessageResponse,
  type UpdateChatReadMarkerRequest,
  type UpdateConversationReadMarkerResponse,
} from '@repo/shared/chat';
import {
  createReportRequestSchema,
  createReportResponseSchema,
  type CreateReportRequest,
  type CreateReportResponse,
} from '@repo/shared/social-safety/report';

export type ChatApiErrorCode =
  | 'CHAT_API_ABORTED'
  | 'CHAT_API_NETWORK'
  | 'CHAT_API_RESPONSE_INVALID'
  | 'CHAT_API_UNAVAILABLE';

export class ChatApiError extends Error {
  constructor(
    readonly code: ChatApiErrorCode,
    readonly status?: number,
  ) {
    super(toChatApiErrorMessage(code));
    this.name = 'ChatApiError';
  }
}

export function toChatApiErrorMessage(code: ChatApiErrorCode): string {
  switch (code) {
    case 'CHAT_API_ABORTED':
      return '요청이 취소되었어요.';
    case 'CHAT_API_RESPONSE_INVALID':
    case 'CHAT_API_UNAVAILABLE':
    case 'CHAT_API_NETWORK':
      return '채팅 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.';
  }
}

type SafeParseSchema<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
};

async function fetchChatJson<T>(input: {
  path: string;
  method: 'GET' | 'POST';
  schema: SafeParseSchema<T>;
  body?: unknown;
  signal?: AbortSignal;
}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input.path, {
      method: input.method,
      headers: input.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
      cache: 'no-store',
      signal: input.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ChatApiError('CHAT_API_ABORTED');
    }
    throw new ChatApiError('CHAT_API_NETWORK');
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ChatApiError('CHAT_API_RESPONSE_INVALID', response.status);
  }

  if (!response.ok) {
    throw new ChatApiError(
      response.status === 403 || response.status === 404
        ? 'CHAT_API_UNAVAILABLE'
        : 'CHAT_API_NETWORK',
      response.status,
    );
  }

  const parsed = input.schema.safeParse(payload);
  if (!parsed.success) {
    throw new ChatApiError('CHAT_API_RESPONSE_INVALID', response.status);
  }
  return parsed.data;
}

export const chatApi = {
  getThreads(
    options: { cursor?: string | null; limit?: number } = {},
    signal?: AbortSignal,
  ): Promise<ConversationThreadListResponse> {
    const params = new URLSearchParams();
    if (options.cursor) params.set('cursor', options.cursor);
    if (options.limit) params.set('limit', String(options.limit));
    const query = params.size > 0 ? `?${params.toString()}` : '';
    return fetchChatJson({
      path: `/api/chat/threads${query}`,
      method: 'GET',
      schema: conversationThreadListResponseSchema,
      signal,
    });
  },
  getThreadDetail(
    threadId: string,
    signal?: AbortSignal,
  ): Promise<ConversationThreadDetailResponse> {
    return fetchChatJson({
      path: `/api/chat/threads/${encodeURIComponent(threadId)}`,
      method: 'GET',
      schema: conversationThreadDetailResponseSchema,
      signal,
    });
  },
  updateReadMarker(
    threadId: string,
    input: UpdateChatReadMarkerRequest,
    signal?: AbortSignal,
  ): Promise<UpdateConversationReadMarkerResponse> {
    const parsed = updateChatReadMarkerRequestSchema.safeParse(input);
    if (!parsed.success) return Promise.reject(new ChatApiError('CHAT_API_RESPONSE_INVALID'));
    return fetchChatJson({
      path: `/api/chat/threads/${encodeURIComponent(threadId)}/read-marker`,
      method: 'POST',
      schema: updateConversationReadMarkerResponseSchema,
      body: parsed.data,
      signal,
    });
  },
  sendMessage(
    input: SendConversationMessageRequest,
    signal?: AbortSignal,
  ): Promise<SendConversationMessageResponse> {
    const parsed = sendConversationMessageRequestSchema.safeParse(input);
    if (!parsed.success) return Promise.reject(new ChatApiError('CHAT_API_RESPONSE_INVALID'));
    return fetchChatJson({
      path: '/api/chat/messages',
      method: 'POST',
      schema: sendConversationMessageResponseSchema,
      body: parsed.data,
      signal,
    });
  },
  leaveThread(threadId: string, signal?: AbortSignal): Promise<LeaveConversationThreadResponse> {
    return fetchChatJson({
      path: `/api/chat/threads/${encodeURIComponent(threadId)}/leave`,
      method: 'POST',
      schema: leaveConversationThreadResponseSchema,
      signal,
    });
  },
  createReport(input: CreateReportRequest, signal?: AbortSignal): Promise<CreateReportResponse> {
    const parsed = createReportRequestSchema.safeParse(input);
    if (!parsed.success) return Promise.reject(new ChatApiError('CHAT_API_RESPONSE_INVALID'));
    return fetchChatJson({
      path: '/api/reports',
      method: 'POST',
      schema: createReportResponseSchema,
      body: parsed.data,
      signal,
    });
  },
};

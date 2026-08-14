import type { NextRequest, NextResponse } from 'next/server';
import { forwardValidatedBffRequest } from '@/app/api/_bff/forward';

type SafeParseSchema<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
};

function resolveChatOperation(path: string, method: 'GET' | 'POST'): string {
  if (path === '/api/chat/threads') return 'chat.thread.list';
  if (path === '/api/chat/messages') return 'chat.message.create';
  if (path === '/api/chat/conversation-stats') return 'chat.conversation_stats';
  if (path.endsWith('/leave')) return 'chat.thread.leave';
  if (path.endsWith('/read-marker')) return 'chat.thread.read_marker';
  if (method === 'GET' && path.includes('/threads/')) return 'chat.thread.detail';
  return 'chat.request';
}

export async function forwardChatBffRequest<T>(input: {
  request: NextRequest;
  method: 'GET' | 'POST';
  path: string;
  responseSchema: SafeParseSchema<T>;
  includeQuery?: boolean;
  body?: string;
}): Promise<NextResponse> {
  return forwardValidatedBffRequest({
    request: input.request,
    method: input.method,
    path: input.path,
    operation: resolveChatOperation(input.path, input.method),
    authenticated: true,
    includeQuery: input.includeQuery,
    bodyMode: input.body ? 'json' : 'none',
    body: input.body,
    responseSchema: input.responseSchema,
  });
}

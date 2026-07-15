import { conversationThreadListResponseSchema } from '@repo/shared/chat';
import type { NextRequest } from 'next/server';
import { forwardChatBffRequest } from '../_chat-bff';

export async function GET(request: NextRequest) {
  return forwardChatBffRequest({
    request,
    method: 'GET',
    path: '/api/chat/threads',
    includeQuery: true,
    responseSchema: conversationThreadListResponseSchema,
  });
}

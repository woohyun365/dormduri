import { conversationThreadDetailResponseSchema } from '@repo/shared/chat';
import type { NextRequest } from 'next/server';
import { encodeBffPathSegment, resolveBffRouteParams } from '@/app/api/_bff/forward';
import { forwardChatBffRequest } from '../../_chat-bff';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await resolveBffRouteParams(context);
  return forwardChatBffRequest({
    request,
    method: 'GET',
    path: `/api/chat/threads/${encodeBffPathSegment(id)}`,
    responseSchema: conversationThreadDetailResponseSchema,
  });
}

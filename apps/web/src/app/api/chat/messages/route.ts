import {
  sendConversationMessageRequestSchema,
  sendConversationMessageResponseSchema,
} from '@repo/shared/chat';
import type { NextRequest } from 'next/server';
import { buildSafeBffErrorResponse } from '@/app/api/_bff/security';
import { forwardChatBffRequest } from '../_chat-bff';

export async function POST(request: NextRequest) {
  const body = await request.text();
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return buildSafeBffErrorResponse('BFF_REQUEST_BODY_INVALID', 400);
  }
  const parsed = sendConversationMessageRequestSchema.safeParse(payload);
  if (!parsed.success) return buildSafeBffErrorResponse('BFF_REQUEST_BODY_INVALID', 400);

  return forwardChatBffRequest({
    request,
    method: 'POST',
    path: '/api/chat/messages',
    responseSchema: sendConversationMessageResponseSchema,
    body: JSON.stringify(parsed.data),
  });
}

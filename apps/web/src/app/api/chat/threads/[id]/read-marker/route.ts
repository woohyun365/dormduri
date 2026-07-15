import {
  updateChatReadMarkerRequestSchema,
  updateConversationReadMarkerResponseSchema,
} from '@repo/shared/chat';
import type { NextRequest } from 'next/server';
import { encodeBffPathSegment, resolveBffRouteParams } from '@/app/api/_bff/forward';
import { buildSafeBffErrorResponse } from '@/app/api/_bff/security';
import { forwardChatBffRequest } from '../../../_chat-bff';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const body = await request.text();
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return buildSafeBffErrorResponse('BFF_REQUEST_BODY_INVALID', 400);
  }
  const parsed = updateChatReadMarkerRequestSchema.safeParse(payload);
  if (!parsed.success) return buildSafeBffErrorResponse('BFF_REQUEST_BODY_INVALID', 400);

  const { id } = await resolveBffRouteParams(context);
  return forwardChatBffRequest({
    request,
    method: 'POST',
    path: `/api/chat/threads/${encodeBffPathSegment(id)}/read-marker`,
    responseSchema: updateConversationReadMarkerResponseSchema,
    body: JSON.stringify(parsed.data),
  });
}

import type { NextRequest } from 'next/server';
import { emailRequestSchema } from '@repo/shared/auth/contract';
import {
  buildJsonResponse,
  forwardAuthRequest,
  getForwardHeaders,
  parseStrictJsonRequest,
  pickAuthMutationResponseBody,
} from '@/auth/bff';

export async function POST(request: NextRequest) {
  const parsed = await parseStrictJsonRequest(
    request,
    emailRequestSchema,
    'INVALID_RESET_CODE_REQUEST',
  );
  if (!parsed.success) {
    return parsed.response;
  }

  const { response, json } = await forwardAuthRequest(
    'POST',
    '/auth/send-reset-code',
    parsed.data,
    {
      headers: getForwardHeaders(request),
    },
  );

  return buildJsonResponse(response, pickAuthMutationResponseBody(json));
}

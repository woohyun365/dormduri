import { NextRequest } from 'next/server';
import { verificationCodeRequestSchema } from '@repo/shared/auth/contract';
import { buildJsonResponse, forwardAuthRequest, getForwardHeaders } from '../_shared';
import { parseStrictJsonRequest, pickAuthMutationResponseBody } from '../_request-guard';

export async function POST(request: NextRequest) {
  const parsed = await parseStrictJsonRequest(
    request,
    verificationCodeRequestSchema,
    'INVALID_VERIFY_RESET_CODE_REQUEST',
  );
  if (!parsed.success) {
    return parsed.response;
  }

  const { response, json } = await forwardAuthRequest(
    'POST',
    '/auth/verify-reset-code',
    parsed.data,
    {
      headers: getForwardHeaders(request),
    },
  );

  return buildJsonResponse(response, pickAuthMutationResponseBody(json));
}

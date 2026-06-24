import { NextRequest } from 'next/server';
import { resetPasswordRequestSchema } from '@repo/shared/auth/contract';
import {
  buildJsonResponse,
  clearAuthCookie,
  forwardAuthRequest,
  getForwardHeaders,
} from '../_shared';
import { parseStrictJsonRequest, pickAuthMutationResponseBody } from '../_request-guard';

export async function POST(request: NextRequest) {
  const parsed = await parseStrictJsonRequest(
    request,
    resetPasswordRequestSchema,
    'INVALID_RESET_PASSWORD_REQUEST',
  );
  if (!parsed.success) {
    return parsed.response;
  }

  const { response, json } = await forwardAuthRequest('POST', '/auth/reset-password', parsed.data, {
    headers: getForwardHeaders(request),
  });

  const nextResponse = buildJsonResponse(response, pickAuthMutationResponseBody(json));
  if (json.success === true) {
    clearAuthCookie(nextResponse);
  }

  return nextResponse;
}

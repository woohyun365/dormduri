import type { NextRequest } from 'next/server';
import {
  AUTH_VERIFICATION_GRANT_HEADER,
  resetPasswordRequestSchema,
} from '@repo/shared/auth/contract';
import { AUTH_RESET_RESTART_REQUIRED_CODE } from '@repo/shared/auth/response';
import {
  buildJsonResponse,
  clearAuthCookie,
  clearVerificationGrantCookie,
  forwardAuthRequest,
  getVerificationGrantCookie,
  getForwardHeaders,
  parseStrictJsonRequest,
  pickAuthMutationResponseBody,
} from '@/auth/bff';

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
    headers: getForwardHeaders(request, {
      [AUTH_VERIFICATION_GRANT_HEADER]:
        getVerificationGrantCookie(request, 'password-reset') ?? undefined,
    }),
  });

  const nextResponse = buildJsonResponse(response, pickAuthMutationResponseBody(json));
  if (json.success === true) {
    clearAuthCookie(nextResponse);
  }
  if (json.success === true || json.code === AUTH_RESET_RESTART_REQUIRED_CODE) {
    clearVerificationGrantCookie(nextResponse, 'password-reset');
  }

  return nextResponse;
}

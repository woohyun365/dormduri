import type { NextRequest } from 'next/server';
import { verificationCodeRequestSchema } from '@repo/shared/auth/contract';
import { verifyResetCodeTransportResponseSchema } from '@repo/shared/auth/response';
import {
  buildJsonResponse,
  forwardAuthRequest,
  getForwardHeaders,
  parseStrictJsonRequest,
  pickAuthMutationResponseBody,
  setVerificationGrantCookie,
} from '@/auth/bff';

export async function POST(request: NextRequest) {
  const parsed = await parseStrictJsonRequest(
    request,
    verificationCodeRequestSchema,
    'INVALID_VERIFY_RESET_CODE_REQUEST',
  );
  if (!parsed.success) {
    return parsed.response;
  }

  const { response, json, failureKind } = await forwardAuthRequest(
    'POST',
    '/auth/verify-reset-code',
    parsed.data,
    {
      headers: getForwardHeaders(request),
    },
    { responseSchema: verifyResetCodeTransportResponseSchema },
  );

  if (failureKind) {
    return buildJsonResponse(response, pickAuthMutationResponseBody(json));
  }

  const nextResponse = buildJsonResponse(response, {
    ...pickAuthMutationResponseBody(json),
    grantExpiresInSeconds: json.grantExpiresInSeconds,
  });
  if (
    json.success === true &&
    typeof json.resetGrant === 'string' &&
    typeof json.grantExpiresInSeconds === 'number'
  ) {
    setVerificationGrantCookie(
      nextResponse,
      'password-reset',
      json.resetGrant,
      json.grantExpiresInSeconds,
    );
  }

  return nextResponse;
}

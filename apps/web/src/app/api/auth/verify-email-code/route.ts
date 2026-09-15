import type { NextRequest } from 'next/server';
import { verificationCodeRequestSchema } from '@repo/shared/auth/contract';
import { verifySignupCodeTransportResponseSchema } from '@repo/shared/auth/response';
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
    'INVALID_VERIFY_EMAIL_CODE_REQUEST',
  );
  if (!parsed.success) {
    return parsed.response;
  }

  const { response, json, failureKind } = await forwardAuthRequest(
    'POST',
    '/auth/verify-email-code',
    parsed.data,
    { headers: getForwardHeaders(request) },
    { requestHeaders: request.headers, responseSchema: verifySignupCodeTransportResponseSchema },
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
    typeof json.signupGrant === 'string' &&
    typeof json.grantExpiresInSeconds === 'number'
  ) {
    setVerificationGrantCookie(
      nextResponse,
      'signup',
      json.signupGrant,
      json.grantExpiresInSeconds,
    );
  }

  return nextResponse;
}

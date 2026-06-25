import type { NextRequest } from 'next/server';
import { signupRequestSchema } from '@repo/shared/auth/contract';
import {
  buildJsonResponse,
  forwardAuthRequest,
  getForwardHeaders,
  parseStrictJsonRequest,
  setAuthCookie,
} from '@/auth/bff';

export async function POST(request: NextRequest) {
  const parsed = await parseStrictJsonRequest(
    request,
    signupRequestSchema,
    'INVALID_SIGNUP_REQUEST',
  );
  if (!parsed.success) {
    return parsed.response;
  }

  const { response, json } = await forwardAuthRequest('POST', '/auth/signup', parsed.data, {
    headers: getForwardHeaders(request),
  });

  const nextResponse = buildJsonResponse(response, {
    success: json.success,
    error: json.error,
    code: json.code,
    userActionable: json.userActionable,
    fieldErrors: json.fieldErrors,
    user: json.user,
  });

  if (json.success === true && typeof json.accessToken === 'string') {
    setAuthCookie(nextResponse, json.accessToken);
  }

  return nextResponse;
}

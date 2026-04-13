import { NextRequest } from 'next/server';
import type { SignupRequest } from '@repo/shared/auth-contract';
import {
  buildJsonResponse,
  forwardAuthRequest,
  getForwardHeaders,
  setAuthCookie,
} from '../_shared';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as SignupRequest;
  const { response, json } = await forwardAuthRequest('POST', '/auth/signup', body, {
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

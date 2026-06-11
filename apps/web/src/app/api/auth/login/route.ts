import { NextRequest } from 'next/server';
import type { LoginRequest } from '@repo/shared/auth/contract';
import {
  buildJsonResponse,
  forwardAuthRequest,
  getForwardHeaders,
  setAuthTransportCookies,
} from '../_shared';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as LoginRequest;
  const { response, json } = await forwardAuthRequest('POST', '/auth/login', body, {
    headers: getForwardHeaders(request),
  });

  const nextResponse = buildJsonResponse(response, {
    success: json.success,
    error: json.error,
    code: json.code,
    userActionable: json.userActionable,
    fieldErrors: json.fieldErrors,
    locked: json.locked,
    remainingSeconds: json.remainingSeconds,
    user: json.user,
  });

  if (json.success === true && typeof json.accessToken === 'string') {
    setAuthTransportCookies(nextResponse, {
      accessToken: json.accessToken,
      rememberMe: body.rememberMe === true,
      renewalToken: typeof json.renewalToken === 'string' ? json.renewalToken : undefined,
    });
  }

  return nextResponse;
}

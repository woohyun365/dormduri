import type { NextRequest } from 'next/server';
import { loginRequestSchema } from '@repo/shared/auth/contract';
import {
  buildJsonResponse,
  forwardAuthRequest,
  getForwardHeaders,
  parseStrictJsonRequest,
  setAuthTransportCookies,
} from '@/auth/bff';

export async function POST(request: NextRequest) {
  const parsed = await parseStrictJsonRequest(request, loginRequestSchema, 'INVALID_LOGIN_REQUEST');
  if (!parsed.success) {
    return parsed.response;
  }

  const { response, json } = await forwardAuthRequest('POST', '/auth/login', parsed.data, {
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
      rememberMe: parsed.data.rememberMe === true,
      renewalToken: typeof json.renewalToken === 'string' ? json.renewalToken : undefined,
    });
  }

  return nextResponse;
}

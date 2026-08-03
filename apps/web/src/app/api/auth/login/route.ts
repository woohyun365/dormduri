import type { NextRequest } from 'next/server';
import { loginRequestSchema } from '@repo/shared/auth/contract';
import { loginResponseSchema } from '@repo/shared/auth/response';
import {
  buildJsonResponse,
  forwardAuthRequest,
  getForwardHeaders,
  parseStrictJsonRequest,
  setAuthTransportCookies,
} from '@/auth/bff';

const loginUpstreamResponseSchema = loginResponseSchema.superRefine((value, context) => {
  if (value.success !== true) {
    return;
  }
  for (const field of ['accessToken', 'renewalToken'] as const) {
    if (typeof value[field] !== 'string') {
      context.addIssue({
        code: 'custom',
        message: `Successful login response requires ${field}.`,
        path: [field],
      });
    }
  }
  if (typeof value.rememberMe !== 'boolean') {
    context.addIssue({
      code: 'custom',
      message: 'Successful login response requires rememberMe.',
      path: ['rememberMe'],
    });
  }
});

export async function POST(request: NextRequest) {
  const parsed = await parseStrictJsonRequest(request, loginRequestSchema, 'INVALID_LOGIN_REQUEST');
  if (!parsed.success) {
    return parsed.response;
  }

  const { response, json, failureKind } = await forwardAuthRequest(
    'POST',
    '/auth/login',
    parsed.data,
    {
      headers: getForwardHeaders(request),
    },
    {
      responseSchema: loginUpstreamResponseSchema,
    },
  );

  if (failureKind) {
    return buildJsonResponse(response, {
      success: false,
      code: 'AUTH_SERVICE_UNAVAILABLE',
      userActionable: true,
    });
  }

  const nextResponse = buildJsonResponse(response, {
    success: json.success,
    error: json.error,
    code: json.code,
    userActionable: json.userActionable,
    fieldErrors: json.fieldErrors,
    locked: json.locked,
    remainingSeconds: json.remainingSeconds,
    retryAfterSeconds: json.retryAfterSeconds,
  });

  if (
    json.success === true &&
    typeof json.accessToken === 'string' &&
    typeof json.renewalToken === 'string' &&
    typeof json.rememberMe === 'boolean'
  ) {
    setAuthTransportCookies(nextResponse, {
      accessToken: json.accessToken,
      rememberMe: json.rememberMe,
      renewalToken: json.renewalToken,
    });
  }

  return nextResponse;
}

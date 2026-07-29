import type { NextRequest } from 'next/server';
import { signupRequestSchema } from '@repo/shared/auth/contract';
import { signupResponseSchema } from '@repo/shared/auth/response';
import {
  buildJsonResponse,
  forwardAuthRequest,
  getForwardHeaders,
  parseStrictJsonRequest,
  setAuthTransportCookies,
} from '@/auth/bff';

const signupUpstreamResponseSchema = signupResponseSchema.superRefine((value, context) => {
  if (value.success !== true) {
    return;
  }
  for (const field of ['accessToken', 'renewalToken'] as const) {
    if (typeof value[field] !== 'string') {
      context.addIssue({
        code: 'custom',
        message: `Successful signup response requires ${field}.`,
        path: [field],
      });
    }
  }
  if (value.rememberMe !== false) {
    context.addIssue({
      code: 'custom',
      message: 'Signup session must use browser-session persistence.',
      path: ['rememberMe'],
    });
  }
});

export async function POST(request: NextRequest) {
  const parsed = await parseStrictJsonRequest(
    request,
    signupRequestSchema,
    'INVALID_SIGNUP_REQUEST',
  );
  if (!parsed.success) {
    return parsed.response;
  }

  const { response, json, failureKind } = await forwardAuthRequest(
    'POST',
    '/auth/signup',
    parsed.data,
    {
      headers: getForwardHeaders(request),
    },
    {
      responseSchema: signupUpstreamResponseSchema,
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
    user: json.user,
  });

  if (
    json.success === true &&
    typeof json.accessToken === 'string' &&
    typeof json.renewalToken === 'string' &&
    json.rememberMe === false
  ) {
    setAuthTransportCookies(nextResponse, {
      accessToken: json.accessToken,
      renewalToken: json.renewalToken,
      rememberMe: false,
    });
  }

  return nextResponse;
}

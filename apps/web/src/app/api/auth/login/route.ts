import { NextRequest, NextResponse } from 'next/server';
import { loginRequestSchema } from '@repo/shared/auth/contract';
import {
  buildJsonResponse,
  forwardAuthRequest,
  getForwardHeaders,
  setAuthTransportCookies,
} from '../_shared';

type LoginRequestIssue = {
  code: string;
  path: readonly PropertyKey[];
  keys?: readonly string[];
};

function buildLoginRequestFieldErrors(issues: readonly LoginRequestIssue[]) {
  const fieldErrors: Record<string, string> = {};

  for (const issue of issues) {
    if (issue.code === 'unrecognized_keys' && issue.keys) {
      for (const key of issue.keys) {
        fieldErrors[key] = 'FORBIDDEN_FIELD';
      }
      continue;
    }

    const field = issue.path[0];
    fieldErrors[typeof field === 'string' ? field : '_request'] = 'INVALID_FIELD';
  }

  return fieldErrors;
}

function buildInvalidLoginRequestResponse(fieldErrors?: Record<string, string>) {
  return NextResponse.json(
    {
      success: false,
      code: 'INVALID_LOGIN_REQUEST',
      userActionable: true,
      ...(fieldErrors && Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}),
    },
    { status: 400 },
  );
}

export async function POST(request: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return buildInvalidLoginRequestResponse();
  }

  const parsed = loginRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return buildInvalidLoginRequestResponse(buildLoginRequestFieldErrors(parsed.error.issues));
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

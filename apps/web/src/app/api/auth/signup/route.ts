import { NextRequest, NextResponse } from 'next/server';
import { signupRequestSchema } from '@repo/shared/auth/contract';
import {
  buildJsonResponse,
  forwardAuthRequest,
  getForwardHeaders,
  setAuthCookie,
} from '../_shared';

type SignupRequestIssue = {
  code: string;
  path: readonly PropertyKey[];
  keys?: readonly string[];
};

function buildSignupRequestFieldErrors(issues: readonly SignupRequestIssue[]) {
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

function buildInvalidSignupRequestResponse(fieldErrors?: Record<string, string>) {
  return NextResponse.json(
    {
      success: false,
      code: 'INVALID_SIGNUP_REQUEST',
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
    return buildInvalidSignupRequestResponse();
  }

  const parsed = signupRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return buildInvalidSignupRequestResponse(buildSignupRequestFieldErrors(parsed.error.issues));
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

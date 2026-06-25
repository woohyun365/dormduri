import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

type StrictRequestIssue = {
  code: string;
  path: readonly PropertyKey[];
  keys?: readonly string[];
};

export type StrictRequestSchema<TBody> = {
  safeParse: (
    value: unknown,
  ) =>
    | { success: true; data: TBody }
    | { success: false; error: { issues: readonly StrictRequestIssue[] } };
};

export type AuthMutationResponseBody = {
  success?: unknown;
  error?: unknown;
  code?: unknown;
  userActionable?: unknown;
  fieldErrors?: unknown;
  retryAfterSeconds?: unknown;
};

function buildRequestFieldErrors(issues: readonly StrictRequestIssue[]) {
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

function buildInvalidRequestResponse(code: string, fieldErrors?: Record<string, string>) {
  return NextResponse.json(
    {
      success: false,
      code,
      userActionable: true,
      ...(fieldErrors && Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}),
    },
    { status: 400 },
  );
}

export async function parseStrictJsonRequest<TBody extends Record<string, unknown>>(
  request: NextRequest,
  schema: StrictRequestSchema<TBody>,
  invalidCode: string,
): Promise<{ success: true; data: TBody } | { success: false; response: NextResponse }> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return { success: false, response: buildInvalidRequestResponse(invalidCode) };
  }

  const parsed = schema.safeParse(rawBody);
  if (!parsed.success) {
    return {
      success: false,
      response: buildInvalidRequestResponse(
        invalidCode,
        buildRequestFieldErrors(parsed.error.issues),
      ),
    };
  }

  return { success: true, data: parsed.data };
}

export function pickAuthMutationResponseBody(json: AuthMutationResponseBody) {
  return {
    success: json.success,
    error: json.error,
    code: json.code,
    userActionable: json.userActionable,
    fieldErrors: json.fieldErrors,
    retryAfterSeconds: json.retryAfterSeconds,
  };
}

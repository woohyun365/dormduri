import type { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenCookie, setAuthTransportCookies } from './auth-cookies';
import {
  forwardAuthRequest,
  getForwardHeaders,
  type AuthUpstreamResponseSchema,
} from './auth-forward';
import {
  parseStrictJsonRequest,
  pickAuthMutationResponseBody,
  recordAuthMutationRequestInspection,
  type StrictRequestSchema,
} from './auth-request-guard';
import { buildJsonResponse } from './auth-response';

export function createStrictForwardPostHandler<TBody extends Record<string, unknown>>(input: {
  path: string;
  schema: StrictRequestSchema<TBody>;
  invalidCode: string;
  getAdditionalHeaders?: (request: NextRequest) => Record<string, string | undefined>;
  allowedResponseFields?: readonly string[];
  onResponse?: (response: NextResponse, upstreamBody: Record<string, unknown>) => void;
}) {
  return async function POST(request: NextRequest) {
    const parsed = await parseStrictJsonRequest(request, input.schema, input.invalidCode);
    if (!parsed.success) {
      return parsed.response;
    }

    const { response, json } = await forwardAuthRequest('POST', input.path, parsed.data, {
      headers: getForwardHeaders(request, input.getAdditionalHeaders?.(request)),
    });

    const responseBody: Record<string, unknown> = pickAuthMutationResponseBody(json);
    for (const field of input.allowedResponseFields ?? []) {
      responseBody[field] = json[field];
    }

    const nextResponse = buildJsonResponse(response, responseBody);
    input.onResponse?.(nextResponse, json);
    return nextResponse;
  };
}

export function createAuthenticatedForwardPostHandler<TBody extends Record<string, unknown>>(
  path: string,
  options: {
    setAuthCookieFromAccessToken?: boolean;
    responseSchema?: AuthUpstreamResponseSchema;
  } = {},
) {
  return async function POST(request: NextRequest) {
    recordAuthMutationRequestInspection(request);
    const body = (await request.json()) as TBody;
    const token = getAuthTokenCookie(request);
    const { response, json } = await forwardAuthRequest(
      'POST',
      path,
      body,
      {
        headers: getForwardHeaders(
          request,
          token ? { Authorization: `Bearer ${token}` } : undefined,
        ),
      },
      { responseSchema: options.responseSchema },
    );

    const nextResponse = buildJsonResponse(response, {
      ...json,
      accessToken: undefined,
      renewalToken: undefined,
      rememberMe: undefined,
    });

    if (
      options.setAuthCookieFromAccessToken === true &&
      json.success === true &&
      typeof json.accessToken === 'string'
    ) {
      setAuthTransportCookies(nextResponse, {
        accessToken: json.accessToken,
        rememberMe: json.rememberMe === true,
        renewalToken: typeof json.renewalToken === 'string' ? json.renewalToken : undefined,
      });
    }

    return nextResponse;
  };
}

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { resolveAuthCookieNames } from '@/config/auth-cookie.config';
import { getWebEnv } from '@/config/env';
import {
  buildBffUpstreamUrl,
  buildSafeBffErrorResponse,
  filterForwardHeaderRecord,
  readBffJsonResponse,
} from './security';

const ALLOWED_BFF_METHODS = new Set(['GET', 'POST', 'DELETE']);
const ALLOWED_BODY_MODES = new Set(['none', 'json']);

type BffMethod = 'GET' | 'POST' | 'DELETE';
type BodyMode = 'none' | 'json';

export type BffRouteContext<TParams extends Record<string, string>> = {
  params: TParams | Promise<TParams>;
};

export async function resolveBffRouteParams<TParams extends Record<string, string>>(
  context: BffRouteContext<TParams>,
): Promise<TParams> {
  return context.params;
}

export function encodeBffPathSegment(input: string): string {
  return encodeURIComponent(input);
}

export function getBffAuthTokenCookie(request: NextRequest): string | undefined {
  return request.cookies.get(resolveAuthCookieNames().access)?.value;
}

export function getBffForwardHeaders(
  request: NextRequest,
  options: { authenticated?: boolean; contentType?: string } = {},
): Record<string, string> {
  const forwardedFor = request.headers.get('x-forwarded-for') ?? undefined;
  const userAgent = request.headers.get('user-agent') ?? undefined;
  const headers = filterForwardHeaderRecord({
    'x-forwarded-for': forwardedFor,
    'user-agent': userAgent,
    ...(options.contentType ? { 'Content-Type': options.contentType } : {}),
  });

  if (options.authenticated === true) {
    const token = getBffAuthTokenCookie(request);
    if (token) {
      return filterForwardHeaderRecord(
        {
          ...headers,
          Authorization: `Bearer ${token}`,
        },
        { allowAuthorization: true },
      );
    }
  }

  return headers;
}

function appendRequestSearch(path: string, request: NextRequest): string {
  const search = request.nextUrl.search;
  if (!search) {
    return path;
  }
  return `${path}${search}`;
}

async function readJsonBody(request: NextRequest): Promise<string | undefined> {
  const text = await request.text();
  if (text.trim().length === 0) {
    return undefined;
  }
  return text;
}

function validateForwardInput(input: {
  method: string;
  bodyMode?: string;
}): NextResponse | undefined {
  const bodyMode = input.bodyMode ?? 'none';
  if (!ALLOWED_BFF_METHODS.has(input.method)) {
    return buildSafeBffErrorResponse('BFF_METHOD_NOT_ALLOWED', 405);
  }

  if (!ALLOWED_BODY_MODES.has(bodyMode)) {
    return buildSafeBffErrorResponse('BFF_BODY_MODE_INVALID', 400);
  }

  return undefined;
}

export async function forwardBffRequest(input: {
  request: NextRequest;
  method: BffMethod;
  path: string;
  authenticated?: boolean;
  includeQuery?: boolean;
  bodyMode?: BodyMode;
}): Promise<NextResponse> {
  const invalidInputResponse = validateForwardInput(input);
  if (invalidInputResponse) {
    return invalidInputResponse;
  }

  const body = input.bodyMode === 'json' ? await readJsonBody(input.request) : undefined;
  const contentType = body
    ? (input.request.headers.get('content-type') ?? 'application/json')
    : undefined;
  const upstreamPath =
    input.includeQuery === true ? appendRequestSearch(input.path, input.request) : input.path;

  let upstreamUrl: string;
  try {
    upstreamUrl = buildBffUpstreamUrl({
      apiUpstreamUrl: getWebEnv().apiUpstreamUrl,
      path: upstreamPath,
      allowedPathPrefix: '/api',
    });
  } catch {
    return buildSafeBffErrorResponse('BFF_UPSTREAM_URL_INVALID');
  }

  const response = await fetch(upstreamUrl, {
    method: input.method,
    headers: getBffForwardHeaders(input.request, {
      authenticated: input.authenticated,
      contentType,
    }),
    ...(body ? { body } : {}),
    cache: 'no-store',
  });

  if (response.status === 204 || response.status === 304) {
    return new NextResponse(null, { status: response.status });
  }

  const { response: safeResponse, json } = await readBffJsonResponse(response, {
    redactSensitiveFields: true,
  });
  return NextResponse.json(json, { status: safeResponse.status });
}

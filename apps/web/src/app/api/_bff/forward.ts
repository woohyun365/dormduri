import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { webEnv } from '@/config/env';

const API_URL = webEnv.apiUpstreamUrl;
const AUTH_COOKIE_NAME = 'auth-token';

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
  return request.cookies.get(AUTH_COOKIE_NAME)?.value;
}

export function getBffForwardHeaders(
  request: NextRequest,
  options: { authenticated?: boolean; contentType?: string } = {},
): Record<string, string> {
  const headers: Record<string, string> = {};
  const forwardedFor = request.headers.get('x-forwarded-for');
  const userAgent = request.headers.get('user-agent');

  if (forwardedFor) {
    headers['x-forwarded-for'] = forwardedFor;
  }
  if (userAgent) {
    headers['user-agent'] = userAgent;
  }
  if (options.contentType) {
    headers['Content-Type'] = options.contentType;
  }

  if (options.authenticated === true) {
    const token = getBffAuthTokenCookie(request);
    if (token) {
      headers.Authorization = `Bearer ${token}`;
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

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  if (response.status === 204 || response.status === 304) {
    return {};
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return {};
  }

  const text = await response.text();
  if (text.trim().length === 0) {
    return {};
  }

  return JSON.parse(text) as Record<string, unknown>;
}

export async function forwardBffRequest(input: {
  request: NextRequest;
  method: BffMethod;
  path: string;
  authenticated?: boolean;
  includeQuery?: boolean;
  bodyMode?: BodyMode;
}): Promise<NextResponse> {
  const body = input.bodyMode === 'json' ? await readJsonBody(input.request) : undefined;
  const contentType = body
    ? (input.request.headers.get('content-type') ?? 'application/json')
    : undefined;
  const upstreamPath =
    input.includeQuery === true ? appendRequestSearch(input.path, input.request) : input.path;
  const response = await fetch(`${API_URL}${upstreamPath}`, {
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

  const json = await readJsonResponse(response);
  return NextResponse.json(json, { status: response.status });
}

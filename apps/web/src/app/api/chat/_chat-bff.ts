import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getBffForwardHeaders } from '@/app/api/_bff/forward';
import {
  buildBffUpstreamUrl,
  buildSafeBffErrorResponse,
  readBffJsonResponse,
} from '@/app/api/_bff/security';
import { getWebEnv } from '@/config/env';

type SafeParseSchema<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
};

export async function forwardChatBffRequest<T>(input: {
  request: NextRequest;
  method: 'GET' | 'POST';
  path: string;
  responseSchema: SafeParseSchema<T>;
  includeQuery?: boolean;
  body?: string;
}): Promise<NextResponse> {
  let upstreamUrl: string;
  try {
    const path =
      input.includeQuery && input.request.nextUrl.search
        ? `${input.path}${input.request.nextUrl.search}`
        : input.path;
    upstreamUrl = buildBffUpstreamUrl({
      apiUpstreamUrl: getWebEnv().apiUpstreamUrl,
      path,
      allowedPathPrefix: '/api',
    });
  } catch {
    return buildSafeBffErrorResponse('BFF_UPSTREAM_URL_INVALID');
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: input.method,
      headers: getBffForwardHeaders(input.request, {
        authenticated: true,
        contentType: input.body
          ? (input.request.headers.get('content-type') ?? 'application/json')
          : undefined,
      }),
      ...(input.body ? { body: input.body } : {}),
      cache: 'no-store',
    });
  } catch {
    return buildSafeBffErrorResponse('BFF_UPSTREAM_UNAVAILABLE');
  }

  const { response: safeResponse, json } = await readBffJsonResponse(upstreamResponse, {
    redactSensitiveFields: true,
  });
  if (!safeResponse.ok) {
    return NextResponse.json(json, { status: safeResponse.status });
  }

  const parsed = input.responseSchema.safeParse(json);
  if (!parsed.success) {
    return buildSafeBffErrorResponse('BFF_UPSTREAM_SCHEMA_INVALID');
  }
  return NextResponse.json(parsed.data, { status: safeResponse.status });
}

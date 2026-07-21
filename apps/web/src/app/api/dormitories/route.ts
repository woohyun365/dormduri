import { dormitoryListResponseSchema } from '@repo/shared/dormitory';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getBffForwardHeaders } from '@/app/api/_bff/forward';
import {
  buildBffUpstreamUrl,
  buildSafeBffErrorResponse,
  readBffJsonResponse,
} from '@/app/api/_bff/security';
import { getWebEnv } from '@/config/env';

export async function GET(request: NextRequest) {
  let upstreamUrl: string;
  try {
    upstreamUrl = buildBffUpstreamUrl({
      apiUpstreamUrl: getWebEnv().apiUpstreamUrl,
      path: `/api/dormitories${request.nextUrl.search}`,
      allowedPathPrefix: '/api',
    });
  } catch {
    return buildSafeBffErrorResponse('BFF_UPSTREAM_URL_INVALID');
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: 'GET',
      headers: getBffForwardHeaders(request),
      cache: 'no-store',
    });
  } catch {
    return buildSafeBffErrorResponse('BFF_UPSTREAM_UNAVAILABLE');
  }

  const { response, json } = await readBffJsonResponse(upstreamResponse, {
    redactSensitiveFields: true,
  });
  if (!response.ok) return NextResponse.json(json, { status: response.status });

  const parsed = dormitoryListResponseSchema.safeParse(json);
  return parsed.success
    ? NextResponse.json(parsed.data, { status: response.status })
    : buildSafeBffErrorResponse('BFF_UPSTREAM_SCHEMA_INVALID');
}

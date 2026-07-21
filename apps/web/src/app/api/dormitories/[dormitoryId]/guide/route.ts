import { dormitoryGuideResponseSchema } from '@repo/shared/dormitory';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  encodeBffPathSegment,
  getBffForwardHeaders,
  resolveBffRouteParams,
  type BffRouteContext,
} from '@/app/api/_bff/forward';
import {
  buildBffUpstreamUrl,
  buildSafeBffErrorResponse,
  readBffJsonResponse,
} from '@/app/api/_bff/security';
import { getWebEnv } from '@/config/env';

type RouteParams = { dormitoryId: string };

export async function GET(request: NextRequest, context: BffRouteContext<RouteParams>) {
  const { dormitoryId } = await resolveBffRouteParams(context);

  let upstreamUrl: string;
  try {
    upstreamUrl = buildBffUpstreamUrl({
      apiUpstreamUrl: getWebEnv().apiUpstreamUrl,
      path: `/api/dormitories/${encodeBffPathSegment(dormitoryId)}/guide`,
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

  const parsed = dormitoryGuideResponseSchema.safeParse(json);
  return parsed.success
    ? NextResponse.json(parsed.data, { status: response.status })
    : buildSafeBffErrorResponse('BFF_UPSTREAM_SCHEMA_INVALID');
}

import { publicProfileSchema } from '@repo/shared/profile/contract';
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

type MatchHistoryEntryCounterpartProfileRouteContext = BffRouteContext<{ entryId: string }>;

export async function GET(
  request: NextRequest,
  context: MatchHistoryEntryCounterpartProfileRouteContext,
) {
  const { entryId } = await resolveBffRouteParams(context);
  let upstreamUrl: string;
  try {
    upstreamUrl = buildBffUpstreamUrl({
      apiUpstreamUrl: getWebEnv().apiUpstreamUrl,
      path: `/api/matches/history/entries/${encodeBffPathSegment(entryId)}/counterpart-profile`,
      allowedPathPrefix: '/api',
    });
  } catch {
    return buildSafeBffErrorResponse('BFF_UPSTREAM_URL_INVALID');
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: 'GET',
      headers: getBffForwardHeaders(request, { authenticated: true }),
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

  const parsed = publicProfileSchema.safeParse(json);
  if (!parsed.success) {
    return buildSafeBffErrorResponse('BFF_UPSTREAM_SCHEMA_INVALID');
  }

  return NextResponse.json(parsed.data, { status: safeResponse.status });
}

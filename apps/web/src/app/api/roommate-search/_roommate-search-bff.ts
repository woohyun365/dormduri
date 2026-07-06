import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getBffForwardHeaders } from '@/app/api/_bff/forward';
import {
  buildBffUpstreamUrl,
  buildSafeBffErrorResponse,
  readBffJsonResponse,
} from '@/app/api/_bff/security';
import { getWebEnv } from '@/config/env';

export const ROOMMATE_SEARCH_ALLOWED_QUERY_KEYS = [
  'limit',
  'cursor',
  'scope',
  'sort',
  'minScore',
  'smokingBehavior',
  'bedtime',
  'wakeTime',
  'noiseSensitivity',
  'cleanLevel',
  'sleepHabit',
  'indoorEating',
  'relationshipStyle',
  'college.operator',
  'college.values',
  'college.values[]',
  'grade.operator',
  'grade.values',
  'grade.values[]',
  'mbtiTraits.energy',
  'mbtiTraits.perception',
  'mbtiTraits.decision',
  'mbtiTraits.lifestyle',
  'ageBand.values',
  'ageBand.values[]',
] as const;

export const ROOMMATE_SEARCH_MANIFEST_ALLOWED_QUERY_KEYS = ['scope'] as const;

type RoommateSearchUpstreamPath = '/api/roommate-search' | '/api/roommate-search/manifest';

type SafeParseSchema<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
};

function buildAllowedQueryString(
  request: NextRequest,
  allowedQueryKeys: readonly string[],
): string {
  const allowed = new Set(allowedQueryKeys);
  const query = new URLSearchParams();

  const copiedKeys = new Set<string>();

  for (const key of request.nextUrl.searchParams.keys()) {
    if (!allowed.has(key) || copiedKeys.has(key)) {
      continue;
    }

    copiedKeys.add(key);
    for (const value of request.nextUrl.searchParams.getAll(key)) {
      query.append(key, value);
    }
  }

  const queryString = query.toString();
  return queryString.length > 0 ? `?${queryString}` : '';
}

export async function forwardRoommateSearchGet<TResponse>(input: {
  request: NextRequest;
  upstreamPath: RoommateSearchUpstreamPath;
  allowedQueryKeys: readonly string[];
  responseSchema: SafeParseSchema<TResponse>;
}): Promise<NextResponse> {
  let upstreamUrl: string;
  try {
    upstreamUrl = buildBffUpstreamUrl({
      apiUpstreamUrl: getWebEnv().apiUpstreamUrl,
      path: `${input.upstreamPath}${buildAllowedQueryString(input.request, input.allowedQueryKeys)}`,
      allowedPathPrefix: '/api',
    });
  } catch {
    return buildSafeBffErrorResponse('BFF_UPSTREAM_URL_INVALID');
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: 'GET',
      headers: getBffForwardHeaders(input.request, { authenticated: true }),
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

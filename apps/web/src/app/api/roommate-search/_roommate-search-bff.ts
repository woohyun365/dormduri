import type { NextRequest, NextResponse } from 'next/server';
import { forwardValidatedBffRequest } from '@/app/api/_bff/forward';

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
  return forwardValidatedBffRequest({
    request: input.request,
    method: 'GET',
    path: `${input.upstreamPath}${buildAllowedQueryString(input.request, input.allowedQueryKeys)}`,
    operation:
      input.upstreamPath === '/api/roommate-search'
        ? 'roommate.search'
        : 'roommate.search_manifest',
    authenticated: true,
    responseSchema: input.responseSchema,
  });
}

import { globalNoticeListResponseSchema, listGlobalNoticesQuerySchema } from '@repo/shared/notices';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { forwardValidatedBffRequest } from '@/app/api/_bff/forward';
import { buildSafeBffErrorResponse } from '@/app/api/_bff/security';

const GLOBAL_NOTICE_QUERY_KEYS = ['limit', 'cursor', 'severity', 'relatedSeasonId'] as const;
const GLOBAL_NOTICE_QUERY_KEY_SET = new Set<string>(GLOBAL_NOTICE_QUERY_KEYS);

type GlobalNoticeQueryKey = (typeof GLOBAL_NOTICE_QUERY_KEYS)[number];

function readSingleQueryValue(
  searchParams: URLSearchParams,
  key: GlobalNoticeQueryKey,
): string | undefined | NextResponse {
  const values = searchParams.getAll(key);
  if (values.length > 1) {
    return buildSafeBffErrorResponse('INVALID_GLOBAL_NOTICE_QUERY', 400);
  }
  return values[0];
}

function buildGlobalNoticeListPath(request: NextRequest): string | NextResponse {
  for (const key of request.nextUrl.searchParams.keys()) {
    if (!GLOBAL_NOTICE_QUERY_KEY_SET.has(key)) {
      return buildSafeBffErrorResponse('INVALID_GLOBAL_NOTICE_QUERY', 400);
    }
  }

  const rawQuery: Record<string, string> = {};
  for (const key of GLOBAL_NOTICE_QUERY_KEYS) {
    const value = readSingleQueryValue(request.nextUrl.searchParams, key);
    if (value instanceof NextResponse) return value;
    if (value) rawQuery[key] = value;
  }

  const parsed = listGlobalNoticesQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return buildSafeBffErrorResponse('INVALID_GLOBAL_NOTICE_QUERY', 400);
  }

  const query = new URLSearchParams();
  query.set('limit', String(parsed.data.limit));
  if (parsed.data.cursor) query.set('cursor', parsed.data.cursor);
  if (parsed.data.severity) query.set('severity', parsed.data.severity);
  if (parsed.data.relatedSeasonId) query.set('relatedSeasonId', parsed.data.relatedSeasonId);

  return `/api/notices?${query.toString()}`;
}

export async function GET(request: NextRequest) {
  const path = buildGlobalNoticeListPath(request);
  if (path instanceof NextResponse) return path;

  return forwardValidatedBffRequest({
    request,
    method: 'GET',
    path,
    operation: 'notice.list',
    responseSchema: globalNoticeListResponseSchema,
  });
}

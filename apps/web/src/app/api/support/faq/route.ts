import { NextResponse, type NextRequest } from 'next/server';
import { listSupportFaqQuerySchema } from '@repo/shared/support';
import { forwardBffRequest } from '@/app/api/_bff/forward';
import { buildSafeBffErrorResponse } from '@/app/api/_bff/security';

const SUPPORT_FAQ_QUERY_KEYS = ['category'] as const;

type SupportFaqQueryKey = (typeof SUPPORT_FAQ_QUERY_KEYS)[number];

function readOptionalQueryValue(
  searchParams: URLSearchParams,
  key: SupportFaqQueryKey,
): string | undefined | NextResponse {
  const values = searchParams.getAll(key);
  if (values.length > 1) {
    return buildSafeBffErrorResponse('INVALID_SUPPORT_FAQ_QUERY', 400);
  }
  return values[0];
}

function buildSupportFaqPath(request: NextRequest): string | NextResponse {
  const rawQuery: Record<string, string> = {};

  for (const key of SUPPORT_FAQ_QUERY_KEYS) {
    const value = readOptionalQueryValue(request.nextUrl.searchParams, key);
    if (value instanceof NextResponse) {
      return value;
    }
    if (value) {
      rawQuery[key] = value;
    }
  }

  const parsed = listSupportFaqQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return buildSafeBffErrorResponse('INVALID_SUPPORT_FAQ_QUERY', 400);
  }

  const query = new URLSearchParams();
  if (parsed.data.category) {
    query.set('category', parsed.data.category);
  }
  const search = query.toString();
  return search ? `/api/support/faq?${search}` : '/api/support/faq';
}

export async function GET(request: NextRequest) {
  const path = buildSupportFaqPath(request);
  if (path instanceof NextResponse) {
    return path;
  }

  return forwardBffRequest({
    request,
    operation: 'support.faq.list',
    method: 'GET',
    path,
  });
}

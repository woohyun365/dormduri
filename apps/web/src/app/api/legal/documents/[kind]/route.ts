import { NextResponse, type NextRequest } from 'next/server';
import { legalDocumentKindSchema } from '@repo/shared/legal';
import { buildBffUpstreamUrl, buildSafeBffErrorResponse } from '@/app/api/_bff/security';
import { resolveBffRouteParams, type BffRouteContext } from '@/app/api/_bff/forward';
import { getWebEnv } from '@/config/env';
import { fetchLegalDocumentFromUrl, LegalDocumentFetchError } from '@/legal/api/legal-document.api';

type LegalDocumentRouteContext = BffRouteContext<{ kind: string }>;

function toSafeUpstreamError(error: unknown): NextResponse {
  if (
    error instanceof LegalDocumentFetchError &&
    error.code === 'LEGAL_DOCUMENT_UPSTREAM_INVALID'
  ) {
    return buildSafeBffErrorResponse('LEGAL_DOCUMENT_UPSTREAM_INVALID', 502);
  }

  return buildSafeBffErrorResponse('LEGAL_DOCUMENT_UPSTREAM_UNAVAILABLE', 503);
}

export async function GET(_request: NextRequest, context: LegalDocumentRouteContext) {
  const { kind } = await resolveBffRouteParams(context);
  const parsedKind = legalDocumentKindSchema.safeParse(kind);

  if (!parsedKind.success) {
    return buildSafeBffErrorResponse('INVALID_LEGAL_DOCUMENT_KIND', 400);
  }

  let upstreamUrl: string;
  try {
    upstreamUrl = buildBffUpstreamUrl({
      apiUpstreamUrl: getWebEnv().apiUpstreamUrl,
      path: `/api/legal/documents/${encodeURIComponent(parsedKind.data)}/active`,
      allowedPathPrefix: '/api',
    });
  } catch {
    return buildSafeBffErrorResponse('BFF_UPSTREAM_URL_INVALID');
  }

  try {
    const document = await fetchLegalDocumentFromUrl(upstreamUrl);
    return NextResponse.json(document, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return toSafeUpstreamError(error);
  }
}

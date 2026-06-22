import { NextResponse, type NextRequest } from 'next/server';
import { buildBffUpstreamUrl, buildSafeBffErrorResponse } from '@/app/api/_bff/security';
import { getWebEnv } from '@/config/env';
import {
  fetchActiveLegalDocumentsBundleFromUrl,
  LegalDocumentsBundleFetchError,
} from '@/legal/api/legal-documents-bundle.api';

function toSafeUpstreamError(error: unknown): NextResponse {
  if (
    error instanceof LegalDocumentsBundleFetchError &&
    error.code === 'LEGAL_DOCUMENT_BUNDLE_UPSTREAM_INVALID'
  ) {
    return buildSafeBffErrorResponse('LEGAL_DOCUMENT_BUNDLE_UPSTREAM_INVALID', 502);
  }

  return buildSafeBffErrorResponse('LEGAL_DOCUMENT_BUNDLE_UPSTREAM_UNAVAILABLE', 503);
}

export async function GET(_request: NextRequest) {
  let upstreamUrl: string;
  try {
    upstreamUrl = buildBffUpstreamUrl({
      apiUpstreamUrl: getWebEnv().apiUpstreamUrl,
      path: '/api/legal/documents/active-bundle',
      allowedPathPrefix: '/api',
    });
  } catch {
    return buildSafeBffErrorResponse('BFF_UPSTREAM_URL_INVALID');
  }

  try {
    const bundle = await fetchActiveLegalDocumentsBundleFromUrl(upstreamUrl);
    return NextResponse.json(bundle, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return toSafeUpstreamError(error);
  }
}

import { NextResponse, type NextRequest } from 'next/server';
import { buildBffUpstreamUrl, buildSafeBffErrorResponse } from '@/app/api/_bff/security';
import { getWebEnv } from '@/config/env';
import {
  fetchActiveLegalDocumentsBundleFromUrl,
  LegalDocumentsBundleFetchError,
} from '@/legal/api/legal-documents-bundle.api';
import { startBffReliabilityMeasurement } from '@/app/api/_bff/reliability';

function toSafeUpstreamError(error: unknown): NextResponse {
  if (
    error instanceof LegalDocumentsBundleFetchError &&
    error.code === 'LEGAL_DOCUMENT_BUNDLE_UPSTREAM_INVALID'
  ) {
    return buildSafeBffErrorResponse('LEGAL_DOCUMENT_BUNDLE_UPSTREAM_INVALID', 502);
  }

  return buildSafeBffErrorResponse('LEGAL_DOCUMENT_BUNDLE_UPSTREAM_UNAVAILABLE', 503);
}

export async function GET(request: NextRequest) {
  const measurement = startBffReliabilityMeasurement({
    operation: 'legal.active_bundle',
    method: 'GET',
    authenticated: false,
    request,
  });
  let upstreamUrl: string;
  try {
    upstreamUrl = buildBffUpstreamUrl({
      apiUpstreamUrl: getWebEnv().apiUpstreamUrl,
      path: '/api/legal/documents/active-bundle',
      allowedPathPrefix: '/api',
    });
  } catch {
    measurement.complete({ outcome: 'invalid_config', status: 502 });
    return buildSafeBffErrorResponse('BFF_UPSTREAM_URL_INVALID');
  }

  try {
    const bundle = await fetchActiveLegalDocumentsBundleFromUrl(upstreamUrl, {
      headers: measurement.correlationHeaders,
    });
    measurement.complete({ outcome: 'success', status: 200 });
    return NextResponse.json(bundle, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    measurement.complete({
      outcome:
        error instanceof LegalDocumentsBundleFetchError &&
        error.code === 'LEGAL_DOCUMENT_BUNDLE_UPSTREAM_INVALID'
          ? 'invalid_response'
          : 'upstream_error',
      status: error instanceof LegalDocumentsBundleFetchError ? 502 : 503,
    });
    return toSafeUpstreamError(error);
  }
}

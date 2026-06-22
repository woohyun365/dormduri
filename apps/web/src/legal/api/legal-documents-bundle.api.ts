import {
  activeLegalDocumentsBundleResponseSchema,
  type ActiveLegalDocumentsBundleResponse,
} from '@repo/shared/legal';
import { LEGAL_FALLBACK_DOCUMENTS } from '../content/legal-fallback-documents';

export class LegalDocumentsBundleFetchError extends Error {
  constructor(
    public readonly code:
      | 'LEGAL_DOCUMENT_BUNDLE_UPSTREAM_UNAVAILABLE'
      | 'LEGAL_DOCUMENT_BUNDLE_UPSTREAM_INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'LegalDocumentsBundleFetchError';
  }
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new LegalDocumentsBundleFetchError(
      'LEGAL_DOCUMENT_BUNDLE_UPSTREAM_INVALID',
      'Legal documents bundle upstream response is not JSON.',
    );
  }

  try {
    return await response.json();
  } catch {
    throw new LegalDocumentsBundleFetchError(
      'LEGAL_DOCUMENT_BUNDLE_UPSTREAM_INVALID',
      'Legal documents bundle upstream response JSON is malformed.',
    );
  }
}

export function getFallbackLegalDocumentsBundle(): ActiveLegalDocumentsBundleResponse {
  return activeLegalDocumentsBundleResponseSchema.parse({
    termsOfService: LEGAL_FALLBACK_DOCUMENTS.TERMS_OF_SERVICE,
    privacyPolicy: LEGAL_FALLBACK_DOCUMENTS.PRIVACY_POLICY,
    personalDataCollectionUseConsent: LEGAL_FALLBACK_DOCUMENTS.PERSONAL_DATA_COLLECTION_USE_CONSENT,
    age14OrAboveNotice: LEGAL_FALLBACK_DOCUMENTS.AGE_14_OR_ABOVE_NOTICE,
  });
}

export async function fetchActiveLegalDocumentsBundleFromUrl(
  url: string,
  options: { fetcher?: typeof fetch } = {},
): Promise<ActiveLegalDocumentsBundleResponse> {
  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
  } catch {
    throw new LegalDocumentsBundleFetchError(
      'LEGAL_DOCUMENT_BUNDLE_UPSTREAM_UNAVAILABLE',
      'Legal documents bundle upstream request failed.',
    );
  }

  if (!response.ok) {
    throw new LegalDocumentsBundleFetchError(
      'LEGAL_DOCUMENT_BUNDLE_UPSTREAM_UNAVAILABLE',
      'Legal documents bundle upstream returned an error status.',
    );
  }

  const parsed = activeLegalDocumentsBundleResponseSchema.safeParse(await readJson(response));
  if (!parsed.success) {
    throw new LegalDocumentsBundleFetchError(
      'LEGAL_DOCUMENT_BUNDLE_UPSTREAM_INVALID',
      'Legal documents bundle upstream response did not match the public contract.',
    );
  }

  return parsed.data;
}

export async function getSignupLegalDocumentsBundle(options: { fetcher?: typeof fetch } = {}) {
  try {
    return {
      source: 'api' as const,
      bundle: await fetchActiveLegalDocumentsBundleFromUrl('/api/legal/documents/active-bundle', {
        fetcher: options.fetcher,
      }),
    };
  } catch {
    return {
      source: 'fallback' as const,
      bundle: getFallbackLegalDocumentsBundle(),
    };
  }
}

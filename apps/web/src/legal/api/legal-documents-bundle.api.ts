import {
  activeLegalDocumentsBundleResponseSchema,
  type ActiveLegalDocumentsBundleResponse,
} from '@repo/shared/legal';

export class LegalDocumentsBundleFetchError extends Error {
  constructor(
    public readonly code:
      'LEGAL_DOCUMENT_BUNDLE_UPSTREAM_UNAVAILABLE' | 'LEGAL_DOCUMENT_BUNDLE_UPSTREAM_INVALID',
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

export async function fetchActiveLegalDocumentsBundleFromUrl(
  url: string,
  options: { fetcher?: typeof fetch; headers?: HeadersInit } = {},
): Promise<ActiveLegalDocumentsBundleResponse> {
  let response: Response;
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    new Headers(options.headers).forEach((value, key) => {
      headers[key] = value;
    });
    response = await (options.fetcher ?? fetch)(url, {
      method: 'GET',
      headers,
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

/**
 * The signup documents in effect, or `unavailable`: without the bundle there are no version ids to agree to,
 * so the signup step stops instead of showing a Web copy. The API checks the ids again at signup (fail-closed).
 */
export type SignupLegalDocumentsBundleResult =
  | { readonly status: 'ready'; readonly bundle: ActiveLegalDocumentsBundleResponse }
  | { readonly status: 'unavailable' };

export async function getSignupLegalDocumentsBundle(
  options: { fetcher?: typeof fetch } = {},
): Promise<SignupLegalDocumentsBundleResult> {
  try {
    return {
      status: 'ready',
      bundle: await fetchActiveLegalDocumentsBundleFromUrl('/api/legal/documents/active-bundle', {
        fetcher: options.fetcher,
      }),
    };
  } catch {
    return { status: 'unavailable' };
  }
}

import { legalDocumentResponseSchema, type LegalDocumentResponse } from '@repo/shared/legal';

export class LegalDocumentFetchError extends Error {
  constructor(
    public readonly code: 'LEGAL_DOCUMENT_UPSTREAM_UNAVAILABLE' | 'LEGAL_DOCUMENT_UPSTREAM_INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'LegalDocumentFetchError';
  }
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new LegalDocumentFetchError(
      'LEGAL_DOCUMENT_UPSTREAM_INVALID',
      'Legal document upstream response is not JSON.',
    );
  }

  try {
    return await response.json();
  } catch {
    throw new LegalDocumentFetchError(
      'LEGAL_DOCUMENT_UPSTREAM_INVALID',
      'Legal document upstream response JSON is malformed.',
    );
  }
}

export async function fetchLegalDocumentFromUrl(
  url: string,
  options: { fetcher?: typeof fetch } = {},
): Promise<LegalDocumentResponse> {
  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
  } catch {
    throw new LegalDocumentFetchError(
      'LEGAL_DOCUMENT_UPSTREAM_UNAVAILABLE',
      'Legal document upstream request failed.',
    );
  }

  if (!response.ok) {
    throw new LegalDocumentFetchError(
      'LEGAL_DOCUMENT_UPSTREAM_UNAVAILABLE',
      'Legal document upstream returned an error status.',
    );
  }

  const parsed = legalDocumentResponseSchema.safeParse(await readJson(response));
  if (!parsed.success) {
    throw new LegalDocumentFetchError(
      'LEGAL_DOCUMENT_UPSTREAM_INVALID',
      'Legal document upstream response did not match the public contract.',
    );
  }

  return parsed.data;
}

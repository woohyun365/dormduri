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
  options: { fetcher?: typeof fetch; headers?: HeadersInit } = {},
): Promise<LegalDocumentResponse> {
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

interface PublicReadingSchema<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

/**
 * One public reading request. `version-not-found` is the API 404 for a version address that is not published or was
 * withdrawn; every other answer that is not a contract response (an error status, a timeout, no connection, a body
 * outside the shared contract) is `failed`.
 */
export type LegalPublicReadingOutcome<T> =
  | { readonly kind: 'ok'; readonly data: T }
  | { readonly kind: 'version-not-found' }
  | { readonly kind: 'failed' };

async function readErrorCode(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();
    return typeof body === 'object' && body !== null && 'code' in body
      ? String((body as { code: unknown }).code)
      : undefined;
  } catch {
    return undefined;
  }
}

export async function readLegalPublicResponse<T>(
  url: string,
  schema: PublicReadingSchema<T>,
  options: { fetcher?: typeof fetch; timeoutMs: number },
): Promise<LegalPublicReadingOutcome<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await (options.fetcher ?? fetch)(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (response.status === 404) {
      return (await readErrorCode(response)) === 'LEGAL_DOCUMENT_VERSION_NOT_FOUND'
        ? { kind: 'version-not-found' }
        : { kind: 'failed' };
    }
    if (!response.ok) return { kind: 'failed' };
    const parsed = schema.safeParse(await readJson(response));
    return parsed.success ? { kind: 'ok', data: parsed.data } : { kind: 'failed' };
  } catch {
    return { kind: 'failed' };
  } finally {
    clearTimeout(timer);
  }
}

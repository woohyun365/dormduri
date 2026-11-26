import {
  legalDocumentKindSchema,
  legalDocumentPageResponseSchema,
  legalRevisionNoticesResponseSchema,
  legalVersionComparisonSchema,
  legalVersionKeySchema,
  type LegalDocumentKind,
  type LegalDocumentPageResponse,
  type LegalRevisionNoticesResponse,
  type LegalVersionComparison,
  type LegalVersionKey,
} from '@repo/shared/legal';
import { getWebEnv } from '@/config/env';
import { createOperationalEventEnvelope } from '@/observability/operational/operational-context';
import type { WebLegalLastSuccessEvent } from '@/observability/operational/operational-events';
import { recordServerOperationalEvent } from '@/observability/operational/server-runtime';
import type { LegalLoadResult } from '../model/legal-document.types';
import { readLegalPublicResponse } from './legal-document.api';
import {
  readLegalLastSuccess,
  removeLegalLastSuccess,
  writeLegalLastSuccess,
  type LegalLastSuccessKey,
} from './legal-last-success.store';

// Public legal reading for the Web server. Each request asks the user API once with a short timeout. A contract
// response is the published version (the API answers from the database or from its in-memory versions; the Web cannot
// and need not tell them apart) and is kept as the last success of that request. The API 404 for a version address
// clears the kept file. Any other failure answers the kept file, else nothing. The Web never computes which version is
// current or scheduled: the API owns those rules.

/** Shorter than the deploy smoke request (10 s); the API database read limit (1.5 s) is shorter still. */
export const LEGAL_DOCUMENT_REQUEST_TIMEOUT_MS = 3_000;

export interface LegalLoaderOptions {
  readonly fetcher?: typeof fetch;
  /** The last success directory; the Web env names it by default. */
  readonly directory?: string;
  readonly now?: () => Date;
}

type LegalEventFields = Pick<WebLegalLastSuccessEvent, 'endpoint' | 'documentKind' | 'versionKey'>;

function apiUrl(path: string): string {
  const baseUrl = new URL(getWebEnv().apiUpstreamUrl);
  const basePath = baseUrl.pathname === '/' ? '' : baseUrl.pathname.replace(/\/+$/, '');
  return new URL(`${basePath}${path}`, baseUrl.origin).toString();
}

/** A version given in a URL: absent, or a real `YYYY-MM-DD` date. Anything else names no version. */
function versionKeyOf(value: unknown): LegalVersionKey | 'current' | null {
  if (value === undefined) return 'current';
  const parsed = legalVersionKeySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function recordLegalEvent(
  action: WebLegalLastSuccessEvent['action'],
  fields: LegalEventFields,
  checkedAt?: string,
): void {
  try {
    const env = getWebEnv().operationalTelemetry;
    recordServerOperationalEvent({
      ...createOperationalEventEnvelope({
        pathname: '/legal',
        environment: env.environment,
        release: env.release,
      }),
      eventName: 'web_legal_last_success',
      action,
      ...fields,
      ...(checkedAt === undefined ? {} : { checkedAt }),
    });
  } catch {
    // The log line is fail-open; it never decides what the page shows.
  }
}

async function loadPublicReading<T>(input: {
  key: LegalLastSuccessKey;
  path: string;
  schema: Parameters<typeof readLegalPublicResponse<T>>[1];
  event: LegalEventFields;
  /** Whether the request names a version, so an API 404 for it means that version does not exist. */
  versionAddress: boolean;
  options: LegalLoaderOptions;
}): Promise<LegalLoadResult<T>> {
  const store = { directory: input.options.directory };
  let outcome: Awaited<ReturnType<typeof readLegalPublicResponse<T>>>;
  try {
    outcome = await readLegalPublicResponse(apiUrl(input.path), input.schema, {
      fetcher: input.options.fetcher,
      timeoutMs: LEGAL_DOCUMENT_REQUEST_TIMEOUT_MS,
    });
  } catch {
    outcome = { kind: 'failed' };
  }

  if (outcome.kind === 'ok') {
    try {
      await writeLegalLastSuccess(
        input.key,
        outcome.data,
        (input.options.now ?? (() => new Date()))(),
        store,
      );
    } catch {
      recordLegalEvent('write_failed', input.event);
    }
    return { status: 'published', data: outcome.data };
  }

  if (outcome.kind === 'version-not-found' && input.versionAddress) {
    await removeLegalLastSuccess(input.key, store).catch(() => undefined);
    return { status: 'version-not-found' };
  }

  const kept = await readLegalLastSuccess(input.key, input.schema, store).catch(() => null);
  if (!kept) return { status: 'unavailable' };
  recordLegalEvent('served', input.event, kept.checkedAt);
  return { status: 'last-success', data: kept.response, checkedAt: kept.checkedAt };
}

/** `GET /api/legal/documents/:kind/page`, the version in effect without `version`, else that version. */
export async function loadLegalDocumentPage(
  kind: LegalDocumentKind,
  version: unknown,
  options: LegalLoaderOptions = {},
): Promise<LegalLoadResult<LegalDocumentPageResponse>> {
  const parsedKind = legalDocumentKindSchema.parse(kind);
  const versionKey = versionKeyOf(version);
  if (versionKey === null) return { status: 'version-not-found' };
  const query = versionKey === 'current' ? '' : `?version=${versionKey}`;
  return loadPublicReading({
    key: { endpoint: 'page', kind: parsedKind, versionKey },
    path: `/api/legal/documents/${parsedKind}/page${query}`,
    schema: legalDocumentPageResponseSchema,
    event: { endpoint: 'page', documentKind: parsedKind, versionKey },
    versionAddress: versionKey !== 'current',
    options,
  });
}

/** `GET /api/legal/documents/:kind/versions/:versionKey/comparison`. */
export async function loadLegalVersionComparison(
  kind: LegalDocumentKind,
  versionKey: unknown,
  options: LegalLoaderOptions = {},
): Promise<LegalLoadResult<LegalVersionComparison>> {
  const parsedKind = legalDocumentKindSchema.parse(kind);
  const parsedKey = versionKeyOf(versionKey);
  if (parsedKey === null || parsedKey === 'current') return { status: 'version-not-found' };
  return loadPublicReading({
    key: { endpoint: 'comparison', kind: parsedKind, versionKey: parsedKey },
    path: `/api/legal/documents/${parsedKind}/versions/${parsedKey}/comparison`,
    schema: legalVersionComparisonSchema,
    event: { endpoint: 'comparison', documentKind: parsedKind, versionKey: parsedKey },
    versionAddress: true,
    options,
  });
}

/** `GET /api/legal/revision-notices`: every kind's scheduled version, for the first-screen revision line. */
export async function loadLegalRevisionNotices(
  options: LegalLoaderOptions = {},
): Promise<LegalLoadResult<LegalRevisionNoticesResponse>> {
  return loadPublicReading({
    key: { endpoint: 'revision-notices' },
    path: '/api/legal/revision-notices',
    schema: legalRevisionNoticesResponseSchema,
    event: { endpoint: 'revision-notices', documentKind: 'all', versionKey: 'all' },
    versionAddress: false,
    options,
  });
}

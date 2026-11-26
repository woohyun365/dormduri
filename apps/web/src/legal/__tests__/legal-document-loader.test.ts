import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LegalDocumentKind,
  legalDocumentPageResponseSchema,
  legalRevisionNoticesResponseSchema,
  legalVersionComparisonSchema,
} from '@repo/shared/legal';
import {
  LEGAL_DOCUMENT_REQUEST_TIMEOUT_MS,
  loadLegalDocumentPage,
  loadLegalRevisionNotices,
  loadLegalVersionComparison,
} from '../api/legal-document.server';
import { readLegalLastSuccess, writeLegalLastSuccess } from '../api/legal-last-success.store';
import {
  seedLegalDocumentPage,
  seedLegalRevisionNotices,
  seedLegalVersionComparison,
} from '../testing/legal-seed-documents';
import type { OperationalEvent } from '@/observability/operational/operational-events';
import { setServerOperationalEventWriterForTests } from '@/observability/operational/server-runtime';

const PRIVACY = LegalDocumentKind.PRIVACY_POLICY;
const currentPrivacy = seedLegalDocumentPage(PRIVACY)!;
const historicalPrivacy = seedLegalDocumentPage(PRIVACY, '2026-06-22')!;
const CHECKED_AT = new Date('2026-11-25T09:30:00.000Z');

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function apiError(status: number, code: string) {
  return json({ code, message: 'x' }, status);
}

let directory: string;
let events: OperationalEvent[];
let restoreWriter: () => void;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'legal-last-success-'));
  events = [];
  restoreWriter = setServerOperationalEventWriterForTests((event) => {
    events.push(event);
  });
});

afterEach(() => {
  restoreWriter();
  vi.useRealTimers();
  rmSync(directory, { recursive: true, force: true });
});

const pageKey = { endpoint: 'page', kind: PRIVACY, versionKey: 'current' } as const;

describe('legal document page loader', () => {
  it('answers the API published version and keeps it as the last success of that request', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json(currentPrivacy));

    const result = await loadLegalDocumentPage(PRIVACY, undefined, {
      fetcher,
      directory,
      now: () => CHECKED_AT,
    });

    expect(result).toEqual({ status: 'published', data: currentPrivacy });
    expect(String(fetcher.mock.calls[0]?.[0])).toMatch(
      /\/api\/legal\/documents\/PRIVACY_POLICY\/page$/u,
    );
    expect(
      await readLegalLastSuccess(pageKey, legalDocumentPageResponseSchema, { directory }),
    ).toEqual({ response: currentPrivacy, checkedAt: CHECKED_AT.toISOString() });
  });

  // The API fails and this request has a last success file.
  it.each([
    ['a connection failure', () => Promise.reject(new TypeError('fetch failed'))],
    ['a 503 without held versions', async () => apiError(503, 'LEGAL_DOCUMENTS_UNAVAILABLE')],
    ['a 502 from the ingress', async () => json({ status: 'unavailable' }, 502)],
    ['a response outside the contract', async () => json({ ...currentPrivacy, kind: 'X' })],
    // No version in effect is answered like any other failure.
    ['a 404 for the version in effect', async () => apiError(404, 'LEGAL_DOCUMENT_NOT_FOUND')],
  ])('answers the last success with its checked time after %s', async (_label, respond) => {
    await writeLegalLastSuccess(pageKey, currentPrivacy, CHECKED_AT, { directory });

    const result = await loadLegalDocumentPage(PRIVACY, undefined, {
      fetcher: vi.fn(respond),
      directory,
    });

    expect(result).toEqual({
      status: 'last-success',
      data: currentPrivacy,
      checkedAt: CHECKED_AT.toISOString(),
    });
    expect(readdirSync(directory)).toHaveLength(1);
    expect(events).toEqual([
      expect.objectContaining({
        eventName: 'web_legal_last_success',
        action: 'served',
        endpoint: 'page',
        documentKind: PRIVACY,
        versionKey: 'current',
        checkedAt: CHECKED_AT.toISOString(),
      }),
    ]);
  });

  // A Web env the API address does not pass (production with a local API URL, as the Web-only Playwright
  // lane runs) is a failure to reach the API too, so the directory still comes from the Web env and the file answers.
  it('answers the kept file when the Web env rejects the API address', async () => {
    await writeLegalLastSuccess(pageKey, currentPrivacy, CHECKED_AT, { directory });
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('API_URL', 'http://127.0.0.1:9');
    vi.stubEnv('DORMDURI_LEGAL_LAST_SUCCESS_DIR', directory);
    const fetcher = vi.fn<typeof fetch>(async () => json(currentPrivacy));

    try {
      const result = await loadLegalDocumentPage(PRIVACY, undefined, { fetcher });

      expect(result).toEqual({
        status: 'last-success',
        data: currentPrivacy,
        checkedAt: CHECKED_AT.toISOString(),
      });
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  // The API fails and there is no file.
  it('answers unavailable when the API fails and no last success is kept', async () => {
    const result = await loadLegalDocumentPage(PRIVACY, undefined, {
      fetcher: vi.fn(async () => apiError(503, 'LEGAL_DOCUMENTS_UNAVAILABLE')),
      directory,
    });

    expect(result).toEqual({ status: 'unavailable' });
  });

  it('does not answer a kept file that no longer matches the public contract', async () => {
    await writeLegalLastSuccess(pageKey, currentPrivacy, CHECKED_AT, { directory });
    const [fileName] = readdirSync(directory);
    writeFileSync(
      join(directory, fileName!),
      JSON.stringify({ checkedAt: CHECKED_AT.toISOString(), response: { kind: PRIVACY } }),
    );

    const result = await loadLegalDocumentPage(PRIVACY, undefined, {
      fetcher: vi.fn(async () => apiError(503, 'LEGAL_DOCUMENTS_UNAVAILABLE')),
      directory,
    });

    expect(result).toEqual({ status: 'unavailable' });
  });

  // A withdrawn or unknown version address.
  it('answers version-not-found for the API 404 of a version key and removes its kept file', async () => {
    const versionKey = { endpoint: 'page', kind: PRIVACY, versionKey: '2026-06-22' } as const;
    await writeLegalLastSuccess(versionKey, historicalPrivacy, CHECKED_AT, { directory });
    await writeLegalLastSuccess(pageKey, currentPrivacy, CHECKED_AT, { directory });

    const result = await loadLegalDocumentPage(PRIVACY, '2026-06-22', {
      fetcher: vi.fn(async () => apiError(404, 'LEGAL_DOCUMENT_VERSION_NOT_FOUND')),
      directory,
    });

    expect(result).toEqual({ status: 'version-not-found' });
    expect(
      await readLegalLastSuccess(versionKey, legalDocumentPageResponseSchema, { directory }),
    ).toBeNull();
    expect(
      await readLegalLastSuccess(pageKey, legalDocumentPageResponseSchema, { directory }),
    ).not.toBeNull();
  });

  it('asks the API for a version key and keeps that version under its own key', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json(historicalPrivacy));

    const result = await loadLegalDocumentPage(PRIVACY, '2026-06-22', { fetcher, directory });

    expect(result).toEqual({ status: 'published', data: historicalPrivacy });
    expect(String(fetcher.mock.calls[0]?.[0])).toMatch(
      /\/api\/legal\/documents\/PRIVACY_POLICY\/page\?version=2026-06-22$/u,
    );
    expect(
      await readLegalLastSuccess(
        { endpoint: 'page', kind: PRIVACY, versionKey: '2026-06-22' },
        legalDocumentPageResponseSchema,
        { directory },
      ),
    ).not.toBeNull();
  });

  // A value that is not a real YYYY-MM-DD date never reaches the API and never names a file.
  it.each([['2026-13-01'], ['20261120'], ['../current'], [''], [['2026-06-22', '2026-11-20']]])(
    'answers version-not-found for the malformed version %j without calling the API',
    async (version) => {
      const fetcher = vi.fn<typeof fetch>(async () => json(currentPrivacy));

      const result = await loadLegalDocumentPage(PRIVACY, version, { fetcher, directory });

      expect(result).toEqual({ status: 'version-not-found' });
      expect(fetcher).not.toHaveBeenCalled();
      expect(readdirSync(directory)).toEqual([]);
    },
  );

  it('gives up on the API after the request timeout and answers the last success', async () => {
    await writeLegalLastSuccess(pageKey, currentPrivacy, CHECKED_AT, { directory });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let signal: AbortSignal | undefined;
    const fetcher = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          signal = init?.signal ?? undefined;
          signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );

    const pending = loadLegalDocumentPage(PRIVACY, undefined, { fetcher, directory });
    await vi.advanceTimersByTimeAsync(LEGAL_DOCUMENT_REQUEST_TIMEOUT_MS - 1);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    expect(await pending).toMatchObject({ status: 'last-success' });
    expect(LEGAL_DOCUMENT_REQUEST_TIMEOUT_MS).toBe(3_000);
  });

  it('still answers the published version when the last success cannot be written, and logs it', async () => {
    const blocked = join(directory, 'not-a-directory');
    writeFileSync(blocked, 'x');

    const result = await loadLegalDocumentPage(PRIVACY, undefined, {
      fetcher: vi.fn(async () => json(currentPrivacy)),
      directory: blocked,
    });

    expect(result).toEqual({ status: 'published', data: currentPrivacy });
    expect(events).toEqual([
      expect.objectContaining({
        eventName: 'web_legal_last_success',
        action: 'write_failed',
        endpoint: 'page',
        documentKind: PRIVACY,
        versionKey: 'current',
        // The file system code tells a permission problem from a full volume.
        errorCode: 'ENOTDIR',
      }),
    ]);
  });
});

describe('legal comparison and revision notice loaders', () => {
  it('keeps and answers the article comparison of a version under its key', async () => {
    const comparison = seedLegalVersionComparison(PRIVACY, '2026-11-20')!;
    const fetcher = vi.fn<typeof fetch>(async () => json(comparison));

    expect(await loadLegalVersionComparison(PRIVACY, '2026-11-20', { fetcher, directory })).toEqual(
      { status: 'published', data: comparison },
    );
    expect(String(fetcher.mock.calls[0]?.[0])).toMatch(
      /\/api\/legal\/documents\/PRIVACY_POLICY\/versions\/2026-11-20\/comparison$/u,
    );
    expect(
      await loadLegalVersionComparison(PRIVACY, '2026-11-20', {
        fetcher: vi.fn(async () => Promise.reject(new TypeError('fetch failed'))),
        directory,
      }),
    ).toMatchObject({ status: 'last-success', data: comparison });
    expect(await loadLegalVersionComparison(PRIVACY, 'not-a-date', { fetcher, directory })).toEqual(
      { status: 'version-not-found' },
    );
    expect(
      await readLegalLastSuccess(
        { endpoint: 'comparison', kind: PRIVACY, versionKey: '2026-11-20' },
        legalVersionComparisonSchema,
        { directory },
      ),
    ).not.toBeNull();
  });

  it('keeps and answers the revision notices', async () => {
    const notices = seedLegalRevisionNotices();

    expect(
      await loadLegalRevisionNotices({ fetcher: vi.fn(async () => json(notices)), directory }),
    ).toEqual({ status: 'published', data: notices });
    expect(
      await loadLegalRevisionNotices({
        fetcher: vi.fn(async () => apiError(503, 'LEGAL_DOCUMENTS_UNAVAILABLE')),
        directory,
      }),
    ).toMatchObject({ status: 'last-success', data: notices });
    expect(
      await readLegalLastSuccess(
        { endpoint: 'revision-notices' },
        legalRevisionNoticesResponseSchema,
        {
          directory,
        },
      ),
    ).not.toBeNull();
  });
});

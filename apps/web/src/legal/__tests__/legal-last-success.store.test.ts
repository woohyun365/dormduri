import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LegalDocumentKind, legalDocumentPageResponseSchema } from '@repo/shared/legal';
import {
  DEFAULT_LEGAL_LAST_SUCCESS_DIRECTORY,
  legalLastSuccessFileName,
  readLegalLastSuccess,
  removeLegalLastSuccess,
  writeLegalLastSuccess,
} from '../api/legal-last-success.store';
import { seedLegalDocumentPage } from '../test-support/legal-seed-documents';

const page = seedLegalDocumentPage(LegalDocumentKind.TERMS_OF_SERVICE)!;
const key = {
  endpoint: 'page',
  kind: LegalDocumentKind.TERMS_OF_SERVICE,
  versionKey: 'current',
} as const;
let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'legal-store-'));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe('legal last success store', () => {
  it('names one file per endpoint, kind and version key', () => {
    expect(legalLastSuccessFileName(key)).toBe('page.TERMS_OF_SERVICE.current.json');
    expect(
      legalLastSuccessFileName({
        endpoint: 'page',
        kind: LegalDocumentKind.PRIVACY_POLICY,
        versionKey: '2026-06-22',
      }),
    ).toBe('page.PRIVACY_POLICY.2026-06-22.json');
    expect(
      legalLastSuccessFileName({
        endpoint: 'comparison',
        kind: LegalDocumentKind.PRIVACY_POLICY,
        versionKey: '2026-11-20',
      }),
    ).toBe('comparison.PRIVACY_POLICY.2026-11-20.json');
    expect(legalLastSuccessFileName({ endpoint: 'revision-notices' })).toBe(
      'revision-notices.json',
    );
    expect(DEFAULT_LEGAL_LAST_SUCCESS_DIRECTORY).toBe('/var/lib/dormduri/legal');
  });

  it('writes through a temporary file in the same directory and leaves only the final file', async () => {
    await writeLegalLastSuccess(key, page, new Date('2026-11-25T00:00:00.000Z'), { directory });
    await writeLegalLastSuccess(key, page, new Date('2026-11-26T00:00:00.000Z'), { directory });

    expect(readdirSync(directory)).toEqual(['page.TERMS_OF_SERVICE.current.json']);
    expect(
      JSON.parse(readFileSync(join(directory, 'page.TERMS_OF_SERVICE.current.json'), 'utf8')),
    ).toEqual({
      checkedAt: '2026-11-26T00:00:00.000Z',
      response: page,
    });
  });

  it('reads a kept response only when it matches the schema again', async () => {
    expect(
      await readLegalLastSuccess(key, legalDocumentPageResponseSchema, { directory }),
    ).toBeNull();
    await writeLegalLastSuccess(key, page, new Date('2026-11-26T00:00:00.000Z'), { directory });

    expect(await readLegalLastSuccess(key, legalDocumentPageResponseSchema, { directory })).toEqual(
      {
        response: page,
        checkedAt: '2026-11-26T00:00:00.000Z',
      },
    );
    await writeLegalLastSuccess(key, { kind: 'TERMS_OF_SERVICE' }, new Date(), { directory });
    expect(
      await readLegalLastSuccess(key, legalDocumentPageResponseSchema, { directory }),
    ).toBeNull();
  });

  it('removes a kept response and ignores a missing one', async () => {
    await writeLegalLastSuccess(key, page, new Date(), { directory });

    await removeLegalLastSuccess(key, { directory });
    await removeLegalLastSuccess(key, { directory });

    expect(readdirSync(directory)).toEqual([]);
  });
});

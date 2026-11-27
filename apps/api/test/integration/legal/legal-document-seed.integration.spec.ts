import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createIntegrationDatabaseSandbox,
  type IntegrationDatabaseSandbox,
} from '../_support/integration-db.js';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
// Development and test seed only: production legal versions come from the backoffice approval path.
const SEED_MODULE = path.resolve(
  CURRENT_DIR,
  '../../../prisma/seed-data/reference/seed-legal-documents.js',
);

type SeedLegalDocuments = (client: Client) => Promise<void>;

interface SeededVersion {
  id: string;
  kind: string;
  noticeClass: string;
  effectiveDate: string;
  appliesUntil: string | null;
  contentDigest: string;
  requestedByAccountId: string | null;
  approvedByAccountId: string | null;
  withdrawnAt: Date | null;
}

async function loadSeed(): Promise<SeedLegalDocuments> {
  expect(existsSync(SEED_MODULE), 'legal document seed module').toBe(true);
  const module = (await import(pathToFileURL(SEED_MODULE).href)) as {
    seedLegalDocuments?: SeedLegalDocuments;
  };
  expect(typeof module.seedLegalDocuments).toBe('function');
  return module.seedLegalDocuments!;
}

describe('legal document seed', () => {
  let sandbox: IntegrationDatabaseSandbox;
  let client: Client;

  async function readVersions(): Promise<SeededVersion[]> {
    const result = await client.query<SeededVersion>(`
      SELECT "id", "kind"::text AS "kind", "noticeClass"::text AS "noticeClass",
             "effectiveDate"::text AS "effectiveDate", "appliesUntil"::text AS "appliesUntil",
             "contentDigest", "requestedByAccountId", "approvedByAccountId", "withdrawnAt"
      FROM "LegalDocumentVersion"
      ORDER BY "LegalDocumentVersion"."kind", "LegalDocumentVersion"."effectiveDate"
    `);
    return result.rows;
  }

  beforeAll(async () => {
    sandbox = await createIntegrationDatabaseSandbox('legal_seed');
    client = new Client({ connectionString: sandbox.databaseUrl });
    await client.connect();
  });

  beforeEach(async () => {
    await client.query('TRUNCATE "LegalAcceptanceRecord", "LegalDocumentVersion" CASCADE');
  });

  afterAll(async () => {
    await client?.end();
    await sandbox?.cleanup();
  });

  it('seed는 처리방침 이전 판 기록과 첫 게시, 나머지 셋 첫 게시를 두고 다시 돌려도 같은 행이다', async () => {
    const seedLegalDocuments = await loadSeed();

    await seedLegalDocuments(client);
    const first = await readVersions();
    await seedLegalDocuments(client);
    const second = await readVersions();

    expect(
      first.map((row) => [row.id, row.kind, row.noticeClass, row.effectiveDate, row.appliesUntil]),
    ).toEqual([
      ['terms-of-service-2026-06-22', 'TERMS_OF_SERVICE', 'INITIAL', '2026-06-22', null],
      [
        'privacy-policy-historical-2026-06-22',
        'PRIVACY_POLICY',
        'HISTORICAL',
        '2026-06-22',
        '2026-11-19',
      ],
      ['privacy-policy-2026-06-22', 'PRIVACY_POLICY', 'INITIAL', '2026-11-20', null],
      [
        'personal-data-collection-use-consent-2026-06-22',
        'PERSONAL_DATA_COLLECTION_USE_CONSENT',
        'INITIAL',
        '2026-06-22',
        null,
      ],
      [
        'age-14-or-above-notice-2026-06-22',
        'AGE_14_OR_ABOVE_NOTICE',
        'INITIAL',
        '2026-06-22',
        null,
      ],
    ]);
    expect(second).toEqual(first);
    for (const row of first) {
      expect(row.contentDigest, row.id).toMatch(/^[0-9a-f]{64}$/u);
      // Repository seed versions have no backoffice author or approver.
      expect([row.requestedByAccountId, row.approvedByAccountId, row.withdrawnAt], row.id).toEqual([
        null,
        null,
        null,
      ]);
    }
  });

  it('옛 seed가 처리방침을 2026-06-22 첫 게시로 둔 개발 DB도 seed 한 번으로 이전 판 기록과 2026-11-20 첫 게시가 된다', async () => {
    const seedLegalDocuments = await loadSeed();
    // The shape the migration leaves for an old development row (one privacy version dated 2026-06-22).
    await client.query(`
      INSERT INTO "LegalDocumentVersion" (
        "id", "kind", "version", "title", "summaryItems", "sections", "changeSummary",
        "noticeClass", "effectiveDate", "contentDigest", "publishedAt"
      ) VALUES (
        'privacy-policy-2026-06-22', 'PRIVACY_POLICY', 'privacy-2026-06-22', '처리방침',
        '[]'::jsonb, '[{"type":"paragraph","text":"옛 본문"}]'::jsonb, '옛 요약',
        'INITIAL', DATE '2026-06-22', repeat('0', 64), TIMESTAMPTZ '2026-06-21T15:00:00Z'
      )
    `);

    await seedLegalDocuments(client);

    expect(
      (await readVersions())
        .filter((row) => row.kind === 'PRIVACY_POLICY')
        .map((row) => [row.id, row.noticeClass, row.effectiveDate, row.appliesUntil]),
    ).toEqual([
      ['privacy-policy-historical-2026-06-22', 'HISTORICAL', '2026-06-22', '2026-11-19'],
      ['privacy-policy-2026-06-22', 'INITIAL', '2026-11-20', null],
    ]);
  });
});

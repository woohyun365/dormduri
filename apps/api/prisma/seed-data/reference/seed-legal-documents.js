import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  LEGAL_CONTENT_SCHEMA_VERSION,
  legalContentDigestInput,
  legalDocumentDraftImportSchema,
  legalEffectiveInstant,
} from '@repo/shared/legal';
import { LEGAL_DOCUMENT_REFERENCE_ROWS } from './legal-document-seed-data.js';

// Legal text that is not a Web fallback copy lives in JSON data files next to this module: the version
// seed list (order, dates, notice class), the bodies that are not one of the four document arrays, and
// the first revisions of the privacy policy and the terms of service as backoffice import files
// (`*-first-revision.draft.json`, read by the backoffice import, not by this seed). This module only
// reads the version files.
const LEGAL_SEED_DIRECTORY = new URL('./legal/', import.meta.url);
const CONTENT_FILE_NAME = /^[a-z0-9][a-z0-9.-]*\.json$/u;
const VERSION_SEED_KEYS = [
  'id',
  'content',
  'noticeClass',
  'consentRequired',
  'effectiveDate',
  'appliesUntil',
];
const CONTENT_KEYS = [
  'kind',
  'version',
  'contentSchemaVersion',
  'title',
  'summaryItems',
  'sections',
  'changeSummary',
];

function readLegalSeedJson(fileName) {
  if (!CONTENT_FILE_NAME.test(fileName)) {
    throw new Error(`[legal seed] not a data file name in the legal seed directory: ${fileName}`);
  }
  return JSON.parse(readFileSync(new URL(fileName, LEGAL_SEED_DIRECTORY), 'utf8'));
}

function requireExactKeys(value, keys, label) {
  const actual = Object.keys(value ?? {}).sort();
  const expected = [...keys].sort();
  if (actual.join(',') !== expected.join(',')) {
    throw new Error(`[legal seed] ${label} keys ${actual.join(',')} are not ${expected.join(',')}`);
  }
}

/** The body a version row copies: a Web fallback reference row with the same id, or a JSON content file. */
function versionContent(entry) {
  if (entry.content === 'reference-row') {
    const reference = LEGAL_DOCUMENT_REFERENCE_ROWS.find((row) => row.id === entry.id);
    if (!reference) {
      throw new Error(`[legal seed] missing reference row ${entry.id}`);
    }
    // The four document arrays are the Web fallback copies, written in today's body format.
    return { ...reference, contentSchemaVersion: LEGAL_CONTENT_SCHEMA_VERSION };
  }
  const content = readLegalSeedJson(entry.content);
  requireExactKeys(content, CONTENT_KEYS, entry.content);
  if (content.contentSchemaVersion !== LEGAL_CONTENT_SCHEMA_VERSION) {
    throw new Error(
      `[legal seed] ${entry.content} body format ${content.contentSchemaVersion} has no reader`,
    );
  }
  return content;
}

/**
 * Published versions the development seed writes, in upsert order (`legal/version-seed-rows.json`): a
 * version that moves to a new date comes before the historical record that takes its old date, so a
 * re-run never collides with the partial unique index.
 */
export const LEGAL_DOCUMENT_VERSION_SEED_ROWS = readLegalSeedJson(
  'version-seed-rows.json',
).versions.map((entry) => {
  requireExactKeys(entry, VERSION_SEED_KEYS, `version ${entry.id}`);
  const content = versionContent(entry);
  return {
    id: entry.id,
    kind: content.kind,
    version: content.version,
    contentSchemaVersion: content.contentSchemaVersion,
    title: content.title,
    summaryItems: content.summaryItems,
    sections: content.sections,
    changeSummary: content.changeSummary,
    noticeClass: entry.noticeClass,
    consentRequired: entry.consentRequired,
    effectiveDate: entry.effectiveDate,
    appliesUntil: entry.appliesUntil,
  };
});

/**
 * A seed version as a backoffice import body (the shared import schema, defaults filled). The import
 * export writes it, and the digest below reads it, so an imported seed text gets the seed digest.
 */
export function legalSeedImportBody(row) {
  return legalDocumentDraftImportSchema.parse({
    kind: row.kind,
    contentSchemaVersion: row.contentSchemaVersion,
    title: row.title,
    summaryItems: row.summaryItems,
    sections: row.sections,
    changeSummary: row.changeSummary,
    noticeClass: row.noticeClass,
    consentRequired: row.consentRequired,
    proposedEffectiveDate: row.effectiveDate,
    ...(row.noticeClass === 'HISTORICAL' ? { appliesUntil: row.appliesUntil } : {}),
  });
}

/**
 * The content digest the backoffice also computes: sha256 of the shared fixed-order input built from
 * parsed (default-filled) content, as `legalContentDigestInput` asks.
 */
export function legalSeedContentDigest(row) {
  const body = legalSeedImportBody(row);
  return createHash('sha256')
    .update(
      legalContentDigestInput({
        ...body,
        effectiveDate: body.proposedEffectiveDate,
        appliesUntil: body.appliesUntil ?? null,
      }),
    )
    .digest('hex');
}

/**
 * Development and test seed of published legal versions. Production never runs it: production versions
 * come from backoffice import and approval. Rows are upserted by id in list order, so a re-run gives the
 * same rows. Seed versions have no backoffice author or approver, and their notice starts when they take
 * effect.
 */
export async function seedLegalDocuments(client) {
  for (const row of LEGAL_DOCUMENT_VERSION_SEED_ROWS) {
    // The stored text is the import body (defaults filled), as an approved import stores it, so the
    // digest, the export file and the stored row describe the same content.
    const body = legalSeedImportBody(row);
    await client.query(
      `
        INSERT INTO "LegalDocumentVersion" (
          id,
          kind,
          version,
          "contentSchemaVersion",
          title,
          "summaryItems",
          sections,
          "changeSummary",
          "noticeClass",
          "consentRequired",
          "effectiveDate",
          "appliesUntil",
          "contentDigest",
          "publishedAt",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          $1,
          $2::"LegalDocumentKind",
          $3,
          $4,
          $5,
          $6::jsonb,
          $7::jsonb,
          $8,
          $9::"LegalNoticeClass",
          $10,
          $11::date,
          $12::date,
          $13,
          $14::timestamptz,
          NOW(),
          NOW()
        )
        ON CONFLICT (id)
        DO UPDATE SET
          kind = EXCLUDED.kind,
          version = EXCLUDED.version,
          "contentSchemaVersion" = EXCLUDED."contentSchemaVersion",
          title = EXCLUDED.title,
          "summaryItems" = EXCLUDED."summaryItems",
          sections = EXCLUDED.sections,
          "changeSummary" = EXCLUDED."changeSummary",
          "noticeClass" = EXCLUDED."noticeClass",
          "consentRequired" = EXCLUDED."consentRequired",
          "effectiveDate" = EXCLUDED."effectiveDate",
          "appliesUntil" = EXCLUDED."appliesUntil",
          "contentDigest" = EXCLUDED."contentDigest",
          "publishedAt" = EXCLUDED."publishedAt",
          "requestedByAccountId" = NULL,
          "approvedByAccountId" = NULL,
          "selfApproved" = false,
          "withdrawnAt" = NULL,
          "updatedAt" = NOW()
      `,
      [
        row.id,
        row.kind,
        row.version,
        row.contentSchemaVersion,
        row.title,
        JSON.stringify(body.summaryItems),
        JSON.stringify(body.sections),
        row.changeSummary,
        row.noticeClass,
        row.consentRequired,
        row.effectiveDate,
        row.appliesUntil,
        legalSeedContentDigest(row),
        legalEffectiveInstant(row.effectiveDate).toISOString(),
      ],
    );
  }
}

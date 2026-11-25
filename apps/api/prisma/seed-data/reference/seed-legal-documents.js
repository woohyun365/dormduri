import { createHash } from 'node:crypto';
import { legalContentDigestInput, legalEffectiveInstant } from '@repo/shared/legal';
import { LEGAL_DOCUMENT_VERSION_SEED_ROWS } from './legal-document-seed-data.js';

/** The content digest the backoffice also computes (sha256 of the shared fixed-order input). */
export function legalSeedContentDigest(row) {
  return createHash('sha256')
    .update(
      legalContentDigestInput({
        kind: row.kind,
        title: row.title,
        summaryItems: row.summaryItems,
        sections: row.sections,
        changeSummary: row.changeSummary,
        effectiveDate: row.effectiveDate,
        appliesUntil: row.appliesUntil,
        noticeClass: row.noticeClass,
        consentRequired: row.consentRequired,
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
    await client.query(
      `
        INSERT INTO "LegalDocumentVersion" (
          id,
          kind,
          version,
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
          $5::jsonb,
          $6::jsonb,
          $7,
          $8::"LegalNoticeClass",
          $9,
          $10::date,
          $11::date,
          $12,
          $13::timestamptz,
          NOW(),
          NOW()
        )
        ON CONFLICT (id)
        DO UPDATE SET
          kind = EXCLUDED.kind,
          version = EXCLUDED.version,
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
          "authorAdminAccountId" = NULL,
          "approverAdminAccountId" = NULL,
          "selfApproved" = false,
          "withdrawnAt" = NULL,
          "updatedAt" = NOW()
      `,
      [
        row.id,
        row.kind,
        row.version,
        row.title,
        JSON.stringify(row.summaryItems),
        JSON.stringify(row.sections),
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

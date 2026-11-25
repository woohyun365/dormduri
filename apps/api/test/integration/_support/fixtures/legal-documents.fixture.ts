import { Client } from 'pg';
import { toLegalKstDate } from '@repo/shared/legal';
import type { IntegrationDatabaseSandbox } from '../integration-db.js';

export interface SignupLegalDocumentIds {
  readonly termsVersionId: string;
  readonly privacyPolicyVersionIdShown: string;
  readonly personalDataConsentVersionId: string;
  readonly ageNoticeVersionId: string;
}

const DAY_MS = 24 * 60 * 60 * 1_000;

/**
 * One initial version in effect per kind, written with the suite admin connection: no runtime role may
 * write published legal versions (role-grant-matrix.csv). The effective date is the KST day before the
 * database clock, so each version is in effect when the case runs.
 */
export async function insertSignupLegalDocumentVersions(
  sandbox: IntegrationDatabaseSandbox,
  ids: SignupLegalDocumentIds,
  label: string,
  databaseNow: Date,
): Promise<void> {
  const effectiveDate = toLegalKstDate(new Date(databaseNow.getTime() - DAY_MS));
  const rows = [
    [ids.termsVersionId, 'TERMS_OF_SERVICE', '이용약관'],
    [ids.privacyPolicyVersionIdShown, 'PRIVACY_POLICY', '개인정보 처리방침'],
    [
      ids.personalDataConsentVersionId,
      'PERSONAL_DATA_COLLECTION_USE_CONSENT',
      '개인정보 수집·이용 동의',
    ],
    [ids.ageNoticeVersionId, 'AGE_14_OR_ABOVE_NOTICE', '연령 확인'],
  ] as const;
  const client = new Client({ connectionString: sandbox.databaseUrl });
  await client.connect();
  try {
    for (const [id, kind, title] of rows) {
      await client.query(
        `
          INSERT INTO "LegalDocumentVersion" (
            "id", "kind", "version", "title", "summaryItems", "sections", "changeSummary",
            "noticeClass", "effectiveDate", "contentDigest", "publishedAt"
          ) VALUES (
            $1, $2::"LegalDocumentKind", $3, $4, '[]'::jsonb,
            '[{"type":"paragraph","text":"본문"}]'::jsonb, '변경 요약',
            'INITIAL', $5::date, repeat('0', 64), $6::timestamptz - interval '2 days'
          )
        `,
        [
          id,
          kind,
          `${label}-${kind.toLowerCase()}`,
          `${label} ${title}`,
          effectiveDate,
          databaseNow,
        ],
      );
    }
  } finally {
    await client.end();
  }
}

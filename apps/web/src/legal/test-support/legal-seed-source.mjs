// Test-only (production code may not import apps/web/src/legal/test-support, eslint import/no-restricted-paths): the API
// legal seed files as ES modules without file system reads, so Vitest, Storybook (browser bundle) and Playwright read
// the same text the development database holds. The seed module that writes rows (seed-legal-documents.js) reads
// these with node:fs, so this file imports the data files themselves.
import { LEGAL_DOCUMENT_REFERENCE_ROWS } from '../../../../api/prisma/seed-data/reference/legal-document-seed-data.js';
import privacyFirstRevision from '../../../../api/prisma/seed-data/reference/legal/privacy-policy-first-revision.draft.json' with { type: 'json' };
import privacyHistorical from '../../../../api/prisma/seed-data/reference/legal/privacy-policy-historical-2026-06-22.json' with { type: 'json' };
import termsFirstRevision from '../../../../api/prisma/seed-data/reference/legal/terms-of-service-first-revision.draft.json' with { type: 'json' };
import versionSeedRows from '../../../../api/prisma/seed-data/reference/legal/version-seed-rows.json' with { type: 'json' };

export const LEGAL_SEED_SOURCE = {
  referenceRows: LEGAL_DOCUMENT_REFERENCE_ROWS,
  versionRows: versionSeedRows.versions,
  contentFiles: {
    'privacy-policy-historical-2026-06-22.json': privacyHistorical,
  },
  firstRevisionDrafts: {
    PRIVACY_POLICY: privacyFirstRevision,
    TERMS_OF_SERVICE: termsFirstRevision,
  },
};

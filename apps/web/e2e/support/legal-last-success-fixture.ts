import { execFileSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { LegalDocumentPageResponse } from '@repo/shared/legal';
import { writeLegalLastSuccess } from '../../src/legal/api/legal-last-success.store';

// The Web-only lane has no API (API_URL points at a closed port), so /privacy and /terms show the last success this Web
// kept. This global setup writes those files from the legal seed through the
// test-only seed path and the Web's own store, so the files have the format the Web writes. Only the two documents in
// effect are kept: a version address has no file and shows "cannot load".
export const WEB_E2E_LEGAL_LAST_SUCCESS_DIR = join(tmpdir(), 'dormduri-web-e2e-legal');
export const WEB_E2E_LEGAL_CHECKED_AT = '2026-11-25T09:30:00.000Z';
// The full-stack lane's Web writes the API's published responses here (legal.fullstack.spec.ts reads them back).
export const WEB_FULLSTACK_LEGAL_LAST_SUCCESS_DIR = join(tmpdir(), 'dormduri-web-fullstack-legal');

const KINDS = ['PRIVACY_POLICY', 'TERMS_OF_SERVICE'] as const;

// The seed pages are built in a plain Node process (Node 26 strips the TypeScript types): the Playwright loader reads
// the ES module build of @repo/shared as CommonJS and fails, so this process does not import it.
function seedPages(): Record<(typeof KINDS)[number], LegalDocumentPageResponse> {
  const output = execFileSync(
    process.execPath,
    [
      '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
      '--eval',
      `import('./src/legal/test-support/legal-seed-documents.ts').then((seed) => {
        process.stdout.write(JSON.stringify(Object.fromEntries(
          ${JSON.stringify(KINDS)}.map((kind) => [kind, seed.seedLegalDocumentPage(kind)]),
        )));
      });`,
    ],
    // Playwright runs from apps/web, as e2e/support/home-e2e-seed.ts assumes.
    { cwd: process.cwd(), encoding: 'utf8' },
  );
  return JSON.parse(output) as Record<(typeof KINDS)[number], LegalDocumentPageResponse>;
}

export default async function writeLegalLastSuccessFixture(): Promise<void> {
  const pages = seedPages();

  // The directory belongs to this fixture only; start from the seed files alone.
  await rm(WEB_E2E_LEGAL_LAST_SUCCESS_DIR, { recursive: true, force: true });
  await mkdir(WEB_E2E_LEGAL_LAST_SUCCESS_DIR, { recursive: true });

  for (const kind of KINDS) {
    if (!pages[kind]) throw new Error(`The legal seed has no document in effect for ${kind}.`);
    await writeLegalLastSuccess(
      { endpoint: 'page', kind, versionKey: 'current' },
      pages[kind],
      new Date(WEB_E2E_LEGAL_CHECKED_AT),
      { directory: WEB_E2E_LEGAL_LAST_SUCCESS_DIR },
    );
  }
}

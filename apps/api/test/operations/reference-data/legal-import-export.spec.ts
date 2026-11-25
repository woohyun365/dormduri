import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { legalContentDigestInput, legalDocumentDraftImportSchema } from '@repo/shared/legal';
// @ts-expect-error -- the legal version seed module is plain JS that reads the JSON data files
import * as legalVersionSeed from '../../../prisma/seed-data/reference/seed-legal-documents.js';

const EXPORT_COMMAND = fileURLToPath(
  new URL('../../../prisma/seed-data/reference/export-legal-import-files.js', import.meta.url),
);

type SeedRow = {
  id: string;
  kind: string;
  effectiveDate: string;
  appliesUntil: string | null;
  noticeClass: string;
};

const seed = legalVersionSeed as {
  LEGAL_DOCUMENT_VERSION_SEED_ROWS: SeedRow[];
  legalSeedContentDigest: (row: SeedRow) => string;
};

/**
 * The seed's version list as backoffice import files: the first production publication imports them, so each file must pass
 * the shared import schema and give the digest of the seed version it came from.
 */
describe('legal import file export', () => {
  const directories: string[] = [];
  const outDirectory = () => {
    const directory = mkdtempSync(join(tmpdir(), 'legal-import-'));
    directories.push(directory);
    return directory;
  };

  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('writes one import file per seed version with the seed digest', () => {
    const out = outDirectory();
    execFileSync(process.execPath, [EXPORT_COMMAND, '--out', out], { stdio: 'pipe' });
    const files = readdirSync(out).sort();
    expect(files).toHaveLength(seed.LEGAL_DOCUMENT_VERSION_SEED_ROWS.length);

    for (const row of seed.LEGAL_DOCUMENT_VERSION_SEED_ROWS) {
      const name = files.find((file) => file.startsWith(`${row.id}.`));
      expect(name, row.id).toBeDefined();
      const draft = legalDocumentDraftImportSchema.parse(
        JSON.parse(readFileSync(join(out, name!), 'utf8')),
      );
      expect(draft).toMatchObject({
        kind: row.kind,
        noticeClass: row.noticeClass,
        proposedEffectiveDate: row.effectiveDate,
      });
      const digest = createHash('sha256')
        .update(
          legalContentDigestInput({
            ...draft,
            effectiveDate: draft.proposedEffectiveDate,
            appliesUntil: draft.appliesUntil ?? null,
          }),
        )
        .digest('hex');
      expect(digest, row.id).toBe(seed.legalSeedContentDigest(row));
    }
  });

  it('refuses to overwrite a file that is already there', () => {
    const out = outDirectory();
    const [first] = seed.LEGAL_DOCUMENT_VERSION_SEED_ROWS;
    writeFileSync(join(out, `${first!.id}.import.json`), '{}');
    let stderr = '';
    try {
      execFileSync(process.execPath, [EXPORT_COMMAND, '--out', out], { stdio: 'pipe' });
    } catch (error) {
      stderr = String((error as { stderr?: Buffer }).stderr ?? '');
    }
    expect(stderr).toMatch(/already exists/u);
    expect(readFileSync(join(out, `${first!.id}.import.json`), 'utf8')).toBe('{}');
  });
});

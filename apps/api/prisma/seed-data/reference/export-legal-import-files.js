// Writes the seed's published version list as backoffice import files (plan D-LC9): LD imports each file
// with 'JSON 파일로 초안 만들기' and approves it, so production gets the text the public screen already
// showed. Each file is the shared import format (`legalDocumentDraftImportSchema`); the digest of the
// imported draft equals the seed version's digest. A file that already exists is never overwritten.
//
//   node apps/api/prisma/seed-data/reference/export-legal-import-files.js --out <directory>
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { LEGAL_DOCUMENT_VERSION_SEED_ROWS, legalSeedImportBody } from './seed-legal-documents.js';

function main() {
  const { values } = parseArgs({ options: { out: { type: 'string' } } });
  if (!values.out) {
    process.stderr.write('usage: export-legal-import-files.js --out <directory>\n');
    process.exitCode = 2;
    return;
  }
  const directory = resolve(values.out);
  mkdirSync(directory, { recursive: true });
  const files = LEGAL_DOCUMENT_VERSION_SEED_ROWS.map((row) => ({
    path: join(directory, `${row.id}.import.json`),
    body: `${JSON.stringify(legalSeedImportBody(row), null, 2)}\n`,
  }));
  const existing = files.filter((file) => existsSync(file.path));
  if (existing.length > 0) {
    for (const file of existing) {
      process.stderr.write(`[legal export] ${file.path} already exists; nothing was written\n`);
    }
    process.exitCode = 1;
    return;
  }
  for (const file of files) {
    writeFileSync(file.path, file.body, { flag: 'wx' });
    process.stdout.write(`${file.path}\n`);
  }
}

main();

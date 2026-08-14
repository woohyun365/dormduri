import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { recordIntegrationMigrationInvocation } from '../../integration/_support/integration-migration-evidence.js';

const ENV_KEY = 'KNU_INTEGRATION_MIGRATION_EVIDENCE_FILE';
const originalEvidenceFile = process.env[ENV_KEY];

afterEach(() => {
  if (originalEvidenceFile === undefined) {
    delete process.env[ENV_KEY];
  } else {
    process.env[ENV_KEY] = originalEvidenceFile;
  }
});

describe('integration migration evidence', () => {
  it('does not write evidence unless a test run explicitly requests it', () => {
    delete process.env[ENV_KEY];
    expect(() => recordIntegrationMigrationInvocation('schema_without_evidence')).not.toThrow();
  });

  it('records one JSON line for each successful sandbox migration', () => {
    const directory = mkdtempSync(join(tmpdir(), 'knu-integration-migrations-'));
    const evidenceFile = join(directory, 'migrations.jsonl');
    process.env[ENV_KEY] = evidenceFile;

    try {
      recordIntegrationMigrationInvocation('schema_a');
      recordIntegrationMigrationInvocation('schema_b');

      const records = readFileSync(evidenceFile, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as { schemaName: string });

      expect(records.map((record) => record.schemaName)).toEqual(['schema_a', 'schema_b']);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

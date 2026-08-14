import { appendFileSync } from 'node:fs';

const EVIDENCE_FILE_ENV = 'KNU_INTEGRATION_MIGRATION_EVIDENCE_FILE';

export function recordIntegrationMigrationInvocation(schemaName: string): void {
  const evidenceFile = process.env[EVIDENCE_FILE_ENV];
  if (!evidenceFile) return;

  appendFileSync(
    evidenceFile,
    `${JSON.stringify({ schemaName, recordedAt: new Date().toISOString() })}\n`,
    'utf8',
  );
}

import { describe, expect, it } from 'vitest';
import {
  createIntegrationDatabaseSandbox,
  runPrismaMigrateStatus,
} from './support/integration-db.js';

describe('Prisma migration status integration', () => {
  it('fresh schema에 baseline migration을 적용한 뒤 migrate status가 up to date를 보고한다', async () => {
    const sandbox = await createIntegrationDatabaseSandbox('migration_status_integration');

    try {
      const output = runPrismaMigrateStatus(sandbox.databaseUrl);
      expect(output).toContain('Database schema is up to date');
    } finally {
      await sandbox.cleanup();
    }
  });
});

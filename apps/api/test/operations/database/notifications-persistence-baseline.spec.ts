import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiRoot = process.cwd();
const schemaPath = join(apiRoot, 'prisma/schema.prisma');
const baselineMigrationPath = join(
  apiRoot,
  'prisma/migrations/000000000000_initial_baseline/migration.sql',
);

describe('notifications persistence baseline', () => {
  it('keeps campaign and operator alert records with idempotent source keys', () => {
    const schema = readFileSync(schemaPath, 'utf8');
    const migration = readFileSync(baselineMigrationPath, 'utf8');

    expect(schema).toContain('model NotificationCampaign');
    expect(schema).toContain('model OperatorAlert');
    expect(schema).toContain('PROFILE_MISMATCH_FEEDBACK');
    expect(schema).toContain('SEASON_SYSTEM_NOTICE');
    expect(migration).toContain('NotificationCampaign_kind_sourceType_sourceId_key');
    expect(migration).toContain('OperatorAlert_sourceType_sourceId_category_key');
  });
});

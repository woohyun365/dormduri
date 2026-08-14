import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiRoot = process.cwd();
const schemaPath = join(apiRoot, 'prisma/schema.prisma');
const baselineMigrationPath = join(
  apiRoot,
  'prisma/migrations/000000000000_initial_baseline/migration.sql',
);

describe('support persistence baseline', () => {
  it('keeps ticket and FAQ records with authenticated support-center placement indexes', () => {
    const schema = readFileSync(schemaPath, 'utf8');
    const migration = readFileSync(baselineMigrationPath, 'utf8');

    expect(schema).toContain('model SupportTicket');
    expect(schema).toContain('model SupportTicketMessage');
    expect(schema).toContain('model SupportFaqArticle');
    expect(schema).toContain('model SupportFaqPlacement');
    expect(schema).toContain('SUPPORT_CENTER');
    expect(schema).not.toContain('  LANDING');
    expect(migration).toContain('SupportTicket_requesterUserId_status_lastMessageAt_id_idx');
    expect(migration).toContain('SupportFaqPlacement_articleId_surface_key');
    expect(migration).toContain('SupportFaqPlacement_surface_sortOrder_articleId_idx');
  });
});

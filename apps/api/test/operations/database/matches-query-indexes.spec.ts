import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const baseline = readFileSync(
  join(process.cwd(), 'prisma/migrations/000000000000_initial_baseline/migration.sql'),
  'utf8',
);

describe('matches query persistence indexes', () => {
  it('request·active match·history query index를 schema와 baseline에 유지한다', () => {
    for (const schemaIndex of [
      '@@index([seasonId, requesterParticipantId, createdAt, id])',
      '@@index([seasonId, receiverParticipantId, createdAt, id])',
      '@@index([seasonId, status, expiresAt])',
      '@@index([seasonId, pairKey, status])',
      '@@index([status, endedAt, startedAt, id])',
      '@@index([viewerParticipantId, finalizedAt, createdAt, id])',
    ]) {
      expect(schema).toContain(schemaIndex);
    }

    for (const migrationIndex of [
      'ON "MatchRequest"("seasonId", "requesterParticipantId", "createdAt", "id")',
      'ON "MatchRequest"("seasonId", "receiverParticipantId", "createdAt", "id")',
      'ON "MatchRequest"("seasonId", "status", "expiresAt")',
      'ON "MatchRequest"("seasonId", "pairKey", "status")',
      'ON "ActiveMatch"("status", "endedAt", "startedAt", "id")',
      'ON "SeasonMatchHistoryEntry"("viewerParticipantId", "finalizedAt", "createdAt", "id")',
    ]) {
      expect(baseline).toContain(migrationIndex);
    }
  });
});

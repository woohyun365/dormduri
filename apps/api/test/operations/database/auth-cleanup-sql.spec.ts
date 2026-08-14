import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sqlRoot = join(process.cwd(), 'prisma/sql');

function readSql(name: string) {
  return readFileSync(join(sqlRoot, name), 'utf8');
}

describe('auth operational cleanup SQL', () => {
  it('TTL cleanup query를 indexed cutoff와 ordered bounded delete로 유지한다', () => {
    for (const file of [
      'pruneExpiredAuthSessions.sql',
      'pruneExpiredVerificationCodes.sql',
      'pruneOldVerificationCodeRequestLogs.sql',
      'pruneOldLoginAttempts.sql',
      'pruneOldAuthSecurityEvents.sql',
    ]) {
      const sql = readSql(file);

      expect(sql).toContain('WITH target AS');
      expect(sql).toContain('ORDER BY');
      expect(sql).toContain('LIMIT $2::int');
      expect(sql).toContain('DELETE FROM');
      expect(sql).toContain('RETURNING 1');
      expect(sql).toContain('COUNT(*)::int AS "deletedCount"');
    }
  });

  it('session cleanup은 만료·장기 revoked 세션을 함께 정리한다', () => {
    const sql = readSql('pruneExpiredAuthSessions.sql');

    expect(sql).toContain('WHERE "expiresAt" < $1');
    expect(sql).toContain('OR "revokedAt" < $1');
    expect(sql).toContain('ORDER BY COALESCE("revokedAt", "expiresAt") ASC, id ASC');
  });

  it('verification cleanup은 code TTL과 consume 시점을 분리한다', () => {
    const sql = readSql('pruneExpiredVerificationCodes.sql');

    expect(sql).toContain('WHERE "codeExpiresAt" < $1');
    expect(sql).toContain('OR "consumedAt" < $1');
    expect(sql).toContain('ORDER BY COALESCE("consumedAt", "codeExpiresAt") ASC, id ASC');
  });
});

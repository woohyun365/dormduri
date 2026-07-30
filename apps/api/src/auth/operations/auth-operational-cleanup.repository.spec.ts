import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AuthOperationalCleanupRepository } from './auth-operational-cleanup.repository.js';

type TypedSqlLike = {
  sql: string;
  values: readonly unknown[];
};

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SQL_DIR = path.resolve(CURRENT_DIR, '../../../prisma/sql');

function readSql(name: string) {
  return readFileSync(path.join(SQL_DIR, name), 'utf8');
}

describe('AuthOperationalCleanupRepository', () => {
  it('auth TTL cleanup SQL은 indexed cutoff + ordered limited delete 형태로 유지된다', () => {
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

  it('session cleanup SQL은 expired 세션뿐 아니라 오래된 revoked 세션도 bounded delete 대상으로 삼는다', () => {
    const sql = readSql('pruneExpiredAuthSessions.sql');

    expect(sql).toContain('WHERE "expiresAt" < $1');
    expect(sql).toContain('OR "revokedAt" < $1');
    expect(sql).toContain('ORDER BY COALESCE("revokedAt", "expiresAt") ASC, id ASC');
  });

  it('verification cleanup SQL은 code TTL과 consume 시점을 분리해 bounded delete한다', () => {
    const sql = readSql('pruneExpiredVerificationCodes.sql');

    expect(sql).toContain('WHERE "codeExpiresAt" < $1');
    expect(sql).toContain('OR "consumedAt" < $1');
    expect(sql).toContain('ORDER BY COALESCE("consumedAt", "codeExpiresAt") ASC, id ASC');
  });

  it('TypedSQL cleanup query를 clamp된 batch size로 순차 실행하고 삭제 count를 집계한다', async () => {
    const queryRawTyped = vi
      .fn<(arg0: TypedSqlLike) => Promise<Array<{ deletedCount: number }>>>()
      .mockResolvedValueOnce([{ deletedCount: 1 }])
      .mockResolvedValueOnce([{ deletedCount: 2 }])
      .mockResolvedValueOnce([{ deletedCount: 3 }])
      .mockResolvedValueOnce([{ deletedCount: 4 }])
      .mockResolvedValueOnce([{ deletedCount: 5 }]);
    const prisma = {
      $queryRawTyped: queryRawTyped as never,
    };
    const repository = new AuthOperationalCleanupRepository();
    const cutoff = new Date('2026-06-01T00:00:00.000Z');

    await expect(
      repository.pruneBatch(prisma, {
        expiredSessionCutoff: cutoff,
        verificationCodeCutoff: cutoff,
        verificationRequestLogCutoff: cutoff,
        loginAttemptCutoff: cutoff,
        securityEventCutoff: cutoff,
        batchSize: 5_000,
      }),
    ).resolves.toEqual({
      expiredSessions: 1,
      verificationCodes: 2,
      verificationRequestLogs: 3,
      loginAttempts: 4,
      securityEvents: 5,
    });

    expect(queryRawTyped).toHaveBeenCalledTimes(5);
    for (const [query] of queryRawTyped.mock.calls) {
      expect(query.values).toEqual(expect.arrayContaining([1000]));
    }
  });
});

import { describe, expect, it, vi } from 'vitest';
import { AuthMailOutboxRepository } from './auth-mail-outbox.repository.js';

type TypedSqlLike = {
  sql: string;
  values: readonly unknown[];
};

describe('AuthMailOutboxRepository', () => {
  it('bounded claim은 deterministic order, lease와 SKIP LOCKED를 사용한다', async () => {
    const repository = new AuthMailOutboxRepository();
    const queryRawTyped = vi.fn<(arg0: TypedSqlLike) => Promise<unknown[]>>().mockResolvedValue([]);
    const now = new Date('2026-07-30T00:00:00.000Z');

    await repository.claimBatch({ $queryRawTyped: queryRawTyped } as never, {
      limit: 500,
      now,
      claimLeaseMs: 30_000,
      lockedBy: 'worker-1',
    });

    const query = queryRawTyped.mock.calls[0]?.[0];
    expect(query?.sql).toMatch(/FOR UPDATE SKIP LOCKED/i);
    expect(query?.sql).toMatch(/ORDER BY "availableAt" ASC, "createdAt" ASC, "id" ASC/i);
    expect(query?.sql).toMatch(/LIMIT\s+\$4/i);
    expect(query?.sql).toMatch(/"status" = 'PROCESSING'/i);
    expect(query?.values.at(-1)).toBe(100);
  });
});

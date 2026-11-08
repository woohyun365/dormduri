import type { Prisma } from '@repo/database/client';
import {
  acquireTransactionAdvisoryLock,
  lockActiveMatchRow as lockActiveMatchRowSql,
} from '@repo/database/sql';
import { matchesErrors } from '../../errors/matches.errors.js';

export async function acquireActiveMatchLock(tx: Prisma.TransactionClient, activeMatchId: string) {
  await tx.$queryRawTyped(acquireTransactionAdvisoryLock('active_match_unmatch', activeMatchId));
}

export async function lockActiveMatchRow(tx: Prisma.TransactionClient, activeMatchId: string) {
  const rows = await tx.$queryRawTyped(lockActiveMatchRowSql(activeMatchId));
  if (rows.length === 0) {
    throw matchesErrors.activeMatchNotFound();
  }
}

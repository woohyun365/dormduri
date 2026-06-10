import type { Prisma } from '../generated/prisma/client.js';
import {
  acquireTransactionAdvisoryLock,
  lockActiveMatchRow as lockActiveMatchRowSql,
} from '../generated/prisma/sql.js';
import { matchesErrors } from './matches.errors.js';

export async function acquireActiveMatchLock(tx: Prisma.TransactionClient, activeMatchId: string) {
  await tx.$queryRawTyped(acquireTransactionAdvisoryLock('active_match_unmatch', activeMatchId));
}

export async function lockActiveMatchRow(tx: Prisma.TransactionClient, activeMatchId: string) {
  const rows = await tx.$queryRawTyped(lockActiveMatchRowSql(activeMatchId));
  if (rows.length === 0) {
    throw matchesErrors.activeMatchNotFound();
  }
}

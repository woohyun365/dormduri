import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { getCurrentTimestamp } from '../../generated/prisma/sql.js';
import { apiEnv } from '../../config/env.js';

function isRetryableTransactionConflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const cause = error.cause as
    | {
        kind?: string;
        originalCode?: string;
      }
    | undefined;

  return (
    cause?.kind === 'TransactionWriteConflict' ||
    cause?.originalCode === '40001' ||
    error.message.includes('TransactionWriteConflict')
  );
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: apiEnv.databaseUrl,
        connectionTimeoutMillis: 5_000,
        idleTimeoutMillis: 300_000,
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async runSerializableTransaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    maxRetries: number = 3,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      try {
        return await this.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (isRetryableTransactionConflict(error)) {
          lastError =
            error instanceof Error
              ? error
              : new Error('[PrismaService] retryable transaction conflict');
          continue;
        }

        throw error;
      }
    }

    throw lastError ?? new Error('[PrismaService] serializable transaction retry exhausted');
  }

  async getDatabaseNow(): Promise<Date> {
    const [row] = await this.$queryRawTyped(getCurrentTimestamp());

    if (!row?.now) {
      throw new Error('[PrismaService] failed to resolve database current timestamp');
    }

    return row.now instanceof Date ? row.now : new Date(row.now);
  }
}

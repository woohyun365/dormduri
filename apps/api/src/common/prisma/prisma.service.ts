import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { getCurrentTimestamp } from '../../generated/prisma/sql.js';
import databaseConfig from '../../config/database.config.js';

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
  private readonly pool: Pool;

  constructor(
    @Inject(databaseConfig.KEY)
    databaseSettings: ConfigType<typeof databaseConfig>,
  ) {
    const loggerLabel = PrismaService.name;
    const pool = new Pool({
      connectionString: databaseSettings.runtimeDatabaseUrl,
      max: databaseSettings.poolMax,
      min: databaseSettings.poolMin,
      connectionTimeoutMillis: databaseSettings.adapterConnectionTimeoutMs,
      idleTimeoutMillis: databaseSettings.adapterIdleTimeoutMs,
      query_timeout: databaseSettings.queryTimeoutMs,
      statement_timeout: databaseSettings.statementTimeoutMs,
      application_name: databaseSettings.applicationName,
    });

    const queryLogEvents = databaseSettings.prismaQueryLogEvents
      ? [
          {
            emit: 'event' as const,
            level: 'query' as const,
          },
        ]
      : undefined;

    super({
      adapter: new PrismaPg(pool, {
        schema: databaseSettings.runtimeSchema ?? undefined,
        disposeExternalPool: false,
        onPoolError: (error) => {
          console.error(`[${loggerLabel}] pg pool error`, error);
        },
        onConnectionError: (error) => {
          console.error(`[${loggerLabel}] pg connection error`, error);
        },
      }),
      ...(queryLogEvents ? { log: queryLogEvents } : {}),
    });

    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
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

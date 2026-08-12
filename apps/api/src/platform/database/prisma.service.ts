import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { getCurrentTimestamp } from '../../generated/prisma/sql.js';
import databaseConfig from './database.config.js';
import { AppLoggerService } from '../observability/logging/app-logger.service.js';
import {
  PrismaPoolMetricsService,
  type PrismaPoolMetricProvider,
} from '../observability/metrics/prisma-pool-metrics.service.js';

type DatabaseSettings = ConfigType<typeof databaseConfig>;

export type PrismaConnectionRole = 'runtime' | 'retention_worker' | 'retention_disclosure';
export const PRISMA_SESSION_TIME_ZONE = 'UTC';
const PRISMA_SCHEMA_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/u;

interface ManagedPrismaClientSettings {
  connectionString: string;
  schema: string | null;
  applicationName: string;
}

export function buildPrismaSessionOptions(schema: string | null): string {
  const settings = [`-c timezone=${PRISMA_SESSION_TIME_ZONE}`];
  if (schema) {
    if (!PRISMA_SCHEMA_IDENTIFIER_PATTERN.test(schema)) {
      throw new Error('[PrismaService] invalid database schema identifier');
    }
    settings.push(`-c search_path=${schema}`);
  }
  return settings.join(' ');
}

export function stripPrismaConnectionOptions(connectionString: string): string {
  const url = new URL(connectionString);
  url.searchParams.delete('options');
  return url.toString();
}

export function recordPrismaConnectionAdapterError(
  logger: AppLoggerService,
  input: {
    error: unknown;
    label: string;
    operation: 'pg_pool_error' | 'pg_connection_error';
  },
): void {
  logger.write(
    'error',
    {
      context: input.label,
      domain: 'system',
      errorName: input.error instanceof Error ? input.error.name : 'UnknownError',
      operation: input.operation,
      outcome: 'failure',
    },
    'database connection adapter error',
  );
}

function isRetryableTransactionConflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
    return true;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2010' &&
    typeof error.meta === 'object' &&
    error.meta !== null &&
    'code' in error.meta &&
    error.meta.code === '40001'
  ) {
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
    error.message.includes('TransactionWriteConflict') ||
    error.message.includes('could not serialize access due to concurrent update') ||
    error.message.includes('Code: `40001`')
  );
}

function resolveManagedPrismaClientSettings(
  databaseSettings: DatabaseSettings,
  role: PrismaConnectionRole,
): ManagedPrismaClientSettings {
  switch (role) {
    case 'retention_worker':
      return {
        connectionString: databaseSettings.retentionWorkerDatabaseUrl,
        schema: databaseSettings.retentionWorkerSchema,
        applicationName: databaseSettings.retentionWorkerApplicationName,
      };
    case 'retention_disclosure':
      return {
        connectionString: databaseSettings.retentionDisclosureDatabaseUrl,
        schema: databaseSettings.retentionDisclosureSchema,
        applicationName: databaseSettings.retentionDisclosureApplicationName,
      };
    case 'runtime':
    default:
      return {
        connectionString: databaseSettings.runtimeDatabaseUrl,
        schema: databaseSettings.runtimeSchema,
        applicationName: databaseSettings.applicationName,
      };
  }
}

export abstract class ManagedPrismaClient
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy, PrismaPoolMetricProvider
{
  private readonly pool: Pool;
  private readonly unregisterPoolMetrics: (() => void) | null;

  protected constructor(
    databaseSettings: DatabaseSettings,
    role: PrismaConnectionRole,
    label: string,
    logger: AppLoggerService,
    private readonly poolMetrics?: PrismaPoolMetricsService,
  ) {
    const roleSettings = resolveManagedPrismaClientSettings(databaseSettings, role);
    const pool = new Pool({
      connectionString: stripPrismaConnectionOptions(roleSettings.connectionString),
      max: databaseSettings.poolMax,
      min: databaseSettings.poolMin,
      connectionTimeoutMillis: databaseSettings.adapterConnectionTimeoutMs,
      idleTimeoutMillis: databaseSettings.adapterIdleTimeoutMs,
      query_timeout: databaseSettings.queryTimeoutMs,
      statement_timeout: databaseSettings.statementTimeoutMs,
      application_name: roleSettings.applicationName,
      options: buildPrismaSessionOptions(roleSettings.schema),
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
        schema: roleSettings.schema ?? undefined,
        disposeExternalPool: false,
        onPoolError: (error) => {
          recordPrismaConnectionAdapterError(logger, {
            error,
            label,
            operation: 'pg_pool_error',
          });
        },
        onConnectionError: (error) => {
          recordPrismaConnectionAdapterError(logger, {
            error,
            label,
            operation: 'pg_connection_error',
          });
        },
      }),
      ...(queryLogEvents ? { log: queryLogEvents } : {}),
    });

    this.pool = pool;
    this.unregisterPoolMetrics = this.poolMetrics?.registerPool(this) ?? null;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    this.unregisterPoolMetrics?.();
    await this.$disconnect();
    await this.pool.end();
  }

  snapshotPoolMetrics() {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
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
          this.recordTransactionRetryMetric('retry');
          lastError =
            error instanceof Error
              ? error
              : new Error('[PrismaService] retryable transaction conflict');
          continue;
        }

        throw error;
      }
    }

    this.recordTransactionRetryMetric('exhausted');
    throw lastError ?? new Error('[PrismaService] serializable transaction retry exhausted');
  }

  async getDatabaseNow(): Promise<Date> {
    const [row] = await this.$queryRawTyped(getCurrentTimestamp());

    if (typeof row?.epochSeconds !== 'number' || !Number.isFinite(row.epochSeconds)) {
      throw new Error('[PrismaService] failed to resolve database current timestamp');
    }

    return new Date(row.epochSeconds * 1_000);
  }

  private recordTransactionRetryMetric(outcome: 'retry' | 'exhausted') {
    try {
      this.poolMetrics?.recordSerializableTransactionRetry(outcome);
    } catch {
      // Metrics recording must not affect transaction retry semantics.
    }
  }
}

@Injectable()
export class PrismaService extends ManagedPrismaClient {
  constructor(
    @Inject(databaseConfig.KEY)
    databaseSettings: DatabaseSettings,
    logger: AppLoggerService,
    @Optional()
    poolMetrics?: PrismaPoolMetricsService,
  ) {
    super(databaseSettings, 'runtime', PrismaService.name, logger, poolMetrics);
  }
}

@Injectable()
export class RetentionWorkerPrismaService extends ManagedPrismaClient {
  constructor(
    @Inject(databaseConfig.KEY)
    databaseSettings: DatabaseSettings,
    logger: AppLoggerService,
    @Optional()
    poolMetrics?: PrismaPoolMetricsService,
  ) {
    super(
      databaseSettings,
      'retention_worker',
      RetentionWorkerPrismaService.name,
      logger,
      poolMetrics,
    );
  }
}

@Injectable()
export class RetentionDisclosurePrismaService extends ManagedPrismaClient {
  constructor(
    @Inject(databaseConfig.KEY)
    databaseSettings: DatabaseSettings,
    logger: AppLoggerService,
    @Optional()
    poolMetrics?: PrismaPoolMetricsService,
  ) {
    super(
      databaseSettings,
      'retention_disclosure',
      RetentionDisclosurePrismaService.name,
      logger,
      poolMetrics,
    );
  }
}

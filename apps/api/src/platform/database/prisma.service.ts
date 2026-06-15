import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { getCurrentTimestamp } from '../../generated/prisma/sql.js';
import databaseConfig from '../../config/database.config.js';
import { AppLoggerService } from '../observability/logging/app-logger.service.js';

type DatabaseSettings = ConfigType<typeof databaseConfig>;

export type PrismaConnectionRole = 'runtime' | 'retention_worker' | 'retention_disclosure';
export const ACTIVE_PRISMA_CONNECTION_ROLES: PrismaConnectionRole[] = [
  'runtime',
  'retention_worker',
  'retention_disclosure',
];

interface ManagedPrismaClientSettings {
  connectionString: string;
  schema: string | null;
  applicationName: string;
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

export interface PrismaConnectionPoolBudget {
  activeRoles: PrismaConnectionRole[];
  poolMaxPerRole: number;
  activePoolMaxConnections: number;
  migrationConnectionIncludedInAppPool: false;
  futureRolePoolCost: {
    role: 'auth_cleanup_worker' | 'read_only_operations';
    additionalMaxConnections: number;
  }[];
  alertAtEstimatedConnections: number;
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

export function calculatePrismaConnectionPoolBudget(
  databaseSettings: Pick<DatabaseSettings, 'poolMax'>,
  options: { alertRatio: number } = { alertRatio: 0.8 },
): PrismaConnectionPoolBudget {
  const activeRoles = [...ACTIVE_PRISMA_CONNECTION_ROLES];
  const poolMaxPerRole = databaseSettings.poolMax;
  const activePoolMaxConnections = activeRoles.length * poolMaxPerRole;

  return {
    activeRoles,
    poolMaxPerRole,
    activePoolMaxConnections,
    migrationConnectionIncludedInAppPool: false,
    futureRolePoolCost: [
      {
        role: 'auth_cleanup_worker',
        additionalMaxConnections: poolMaxPerRole,
      },
      {
        role: 'read_only_operations',
        additionalMaxConnections: poolMaxPerRole,
      },
    ],
    alertAtEstimatedConnections: Math.max(
      1,
      Math.floor(activePoolMaxConnections * options.alertRatio),
    ),
  };
}

export abstract class ManagedPrismaClient
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly pool: Pool;

  protected constructor(
    databaseSettings: DatabaseSettings,
    role: PrismaConnectionRole,
    label: string,
    logger: AppLoggerService,
  ) {
    const roleSettings = resolveManagedPrismaClientSettings(databaseSettings, role);
    const pool = new Pool({
      connectionString: roleSettings.connectionString,
      max: databaseSettings.poolMax,
      min: databaseSettings.poolMin,
      connectionTimeoutMillis: databaseSettings.adapterConnectionTimeoutMs,
      idleTimeoutMillis: databaseSettings.adapterIdleTimeoutMs,
      query_timeout: databaseSettings.queryTimeoutMs,
      statement_timeout: databaseSettings.statementTimeoutMs,
      application_name: roleSettings.applicationName,
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

@Injectable()
export class PrismaService extends ManagedPrismaClient {
  constructor(
    @Inject(databaseConfig.KEY)
    databaseSettings: DatabaseSettings,
    logger: AppLoggerService,
  ) {
    super(databaseSettings, 'runtime', PrismaService.name, logger);
  }
}

@Injectable()
export class RetentionWorkerPrismaService extends ManagedPrismaClient {
  constructor(
    @Inject(databaseConfig.KEY)
    databaseSettings: DatabaseSettings,
    logger: AppLoggerService,
  ) {
    super(databaseSettings, 'retention_worker', RetentionWorkerPrismaService.name, logger);
  }
}

@Injectable()
export class RetentionDisclosurePrismaService extends ManagedPrismaClient {
  constructor(
    @Inject(databaseConfig.KEY)
    databaseSettings: DatabaseSettings,
    logger: AppLoggerService,
  ) {
    super(databaseSettings, 'retention_disclosure', RetentionDisclosurePrismaService.name, logger);
  }
}

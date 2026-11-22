import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { Prisma, PrismaClient } from '@repo/database/client';
import { getCurrentTimestamp } from '@repo/database/sql';

const SCHEMA_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/u;

export interface BackofficeDatabaseConnection {
  readonly url: string;
  readonly poolMax: number;
  readonly applicationName: string;
}

export type BackofficeTransaction = Prisma.TransactionClient;

/**
 * Reads the optional `schema` query parameter (integration suites run in their own schema) and
 * returns the pg connection string without the Prisma-only parameters.
 */
export function splitConnectionUrl(url: string): {
  connectionString: string;
  schema: string | null;
} {
  const parsed = new URL(url);
  const schema = parsed.searchParams.get('schema');
  parsed.searchParams.delete('schema');
  parsed.searchParams.delete('options');
  if (schema !== null && !SCHEMA_IDENTIFIER.test(schema)) {
    throw new Error('backoffice database URL has an invalid schema identifier');
  }
  return { connectionString: parsed.toString(), schema: schema === 'public' ? null : schema };
}

function isSerializationConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2034') {
      return true;
    }
    const meta = error.meta as { code?: unknown } | undefined;
    if (error.code === 'P2010' && meta?.code === '40001') {
      return true;
    }
  }
  return error instanceof Error && /40001|could not serialize access/u.test(error.message);
}

/**
 * One PrismaClient over its own pg pool. The backoffice API opens two: the runtime client as
 * `dormduri_backoffice` and the cleanup client as `dormduri_backoffice_retention` (infra/db/README.md grant 표). Each
 * holds only its LOGIN user's grants, so a query outside the grant table fails at the database.
 */
export class BackofficePrismaClient extends PrismaClient {
  private readonly pool: Pool;

  constructor(connection: BackofficeDatabaseConnection) {
    const { connectionString, schema } = splitConnectionUrl(connection.url);
    const options = ['-c timezone=UTC'];
    if (schema) {
      options.push(`-c search_path=${schema}`);
    }
    const pool = new Pool({
      connectionString,
      max: connection.poolMax,
      application_name: connection.applicationName,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      statement_timeout: 15_000,
      options: options.join(' '),
    });
    super({
      adapter: new PrismaPg(pool, {
        schema: schema ?? undefined,
        disposeExternalPool: false,
      }),
    });
    this.pool = pool;
  }

  async close(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
  }

  /** Database clock; cleanup cutoffs compare against rows the database stamped. */
  async databaseNow(): Promise<Date> {
    const [row] = await this.$queryRawTyped(getCurrentTimestamp());
    if (typeof row?.epochSeconds !== 'number' || !Number.isFinite(row.epochSeconds)) {
      throw new Error('database clock is unavailable');
    }
    return new Date(row.epochSeconds * 1_000);
  }

  /**
   * Serializable transaction with retries on serialization conflicts. Decisions that count
   * approvers or change roles use it so two concurrent decisions cannot both see a stale count.
   */
  async serializable<T>(work: (tx: BackofficeTransaction) => Promise<T>, attempts = 3): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await this.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (!isSerializationConflict(error)) {
          throw error;
        }
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('serializable transaction failed');
  }
}

/** Runtime client: every request path (dormduri_backoffice, group backoffice_runtime). */
export class BackofficeRuntimePrisma extends BackofficePrismaClient {}

/** Cleanup client: only the backoffice records cleanup job (dormduri_backoffice_retention). */
export class BackofficeRetentionPrisma extends BackofficePrismaClient {}

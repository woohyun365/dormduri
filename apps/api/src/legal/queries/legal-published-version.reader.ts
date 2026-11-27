import { Inject, Injectable, Logger } from '@nestjs/common';
import type { LegalDocumentKind } from '@repo/shared/legal';
import {
  DOMAIN_METRICS_PORT,
  type DomainMetricsPort,
} from '../../platform/observability/metrics/domain-metrics.port.js';
import { toLegalVersion, type LegalVersion } from '../domain/legal-version.js';
import { legalErrors } from '../errors/legal.errors.js';
import {
  LEGAL_DOCUMENT_READS_METRIC,
  type LegalReadEndpoint,
  type LegalReadOutcome,
  type LegalReadSource,
} from '../observability/legal-metric.definitions.js';
import { LegalDocumentRepository } from '../repositories/legal-document.repository.js';

interface KindSnapshot {
  readonly versions: readonly LegalVersion[];
  readonly databaseNow: Date;
  /** `performance.now()` when `databaseNow` was read: a monotonic clock, unlike the server wall clock. */
  readonly monotonicMs: number;
}

export interface LegalPublishedRead {
  readonly endpoint: LegalReadEndpoint;
  readonly source: LegalReadSource;
  versionsOf(kind: LegalDocumentKind): readonly LegalVersion[];
  /** The clock the version state is computed with: the database time, or for memory the last database time plus the monotonic time since. */
  nowOf(kind: LegalDocumentKind): Date;
}

/**
 * Reads published versions for public legal reading and keeps the last successful read of each kind in
 * process memory. When the database read fails it answers from memory with the same calculation, so
 * a scheduled version still takes effect on time; with nothing in memory it fails with 503. A failed
 * read logs its step and error class and code (never the driver message). Versions
 * change only through an approval, which needs the database, so a memory answer stays correct
 * (single user API instance, docs/architecture/backend/runtime-composition-and-process-state.md).
 */
type ReadStep = 'database_time' | 'published_versions' | 'version_rows';

/**
 * The longest a public reading waits for the database before it answers from memory. It is shorter than the Web
 * request timeout (3 s, apps/web/src/legal/api/legal-document.server.ts), so a database that stops answering never
 * makes the Web give up on an API that still holds the versions.
 */
export const LEGAL_DATABASE_READ_TIMEOUT_MS = 1_500;

class LegalDatabaseReadTimeout extends Error {
  override readonly name = 'LegalDatabaseReadTimeout';
}

/** Error class and its code (a Prisma code or a SQLSTATE) only: a driver message can carry query values. */
function describeReadFailure(error: unknown): { errorType: string; errorCode: string } {
  const errorType = error instanceof Error ? error.name : typeof error;
  const code =
    error !== null && typeof error === 'object' && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined;
  return {
    errorType,
    errorCode: typeof code === 'string' && /^[A-Z0-9]{4,8}$/u.test(code) ? code : 'none',
  };
}

@Injectable()
export class LegalPublishedVersionReader {
  private readonly logger = new Logger(LegalPublishedVersionReader.name);
  private readonly snapshots = new Map<LegalDocumentKind, KindSnapshot>();

  constructor(
    private readonly repository: LegalDocumentRepository,
    @Inject(DOMAIN_METRICS_PORT) private readonly metrics: DomainMetricsPort,
  ) {}

  async read(
    kinds: readonly LegalDocumentKind[],
    endpoint: LegalReadEndpoint,
  ): Promise<LegalPublishedRead> {
    let fresh: Map<LegalDocumentKind, KindSnapshot> | null = null;
    const progress: { step: ReadStep } = { step: 'database_time' };
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // A read that misses the limit is given up; its late result is not used.
      fresh = await Promise.race([
        this.readFromDatabase(kinds, progress),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new LegalDatabaseReadTimeout()),
            LEGAL_DATABASE_READ_TIMEOUT_MS,
          );
        }),
      ]);
    } catch (error) {
      const fallback = kinds.every((kind) => this.snapshots.has(kind)) ? 'memory' : 'unavailable';
      const { errorType, errorCode } = describeReadFailure(error);
      this.logger.warn(
        `[LegalPublishedVersionReader] database read failed endpoint=${endpoint} step=${progress.step} kinds=${kinds.join(',')} errorType=${errorType} errorCode=${errorCode} fallback=${fallback}`,
      );
      fresh = null;
    } finally {
      clearTimeout(timer);
    }

    if (fresh) {
      for (const [kind, snapshot] of fresh) {
        // A read that started earlier can finish later; memory keeps the newest database time.
        const held = this.snapshots.get(kind);
        if (!held || held.databaseNow.getTime() <= snapshot.databaseNow.getTime()) {
          this.snapshots.set(kind, snapshot);
        }
      }
      return this.answer(endpoint, 'database', fresh);
    }

    const held = new Map<LegalDocumentKind, KindSnapshot>();
    for (const kind of kinds) {
      const snapshot = this.snapshots.get(kind);
      if (!snapshot) {
        this.record(endpoint, 'memory', 'unavailable');
        throw legalErrors.documentsUnavailable();
      }
      held.set(kind, snapshot);
    }
    return this.answer(endpoint, 'memory', held);
  }

  private async readFromDatabase(
    kinds: readonly LegalDocumentKind[],
    progress: { step: ReadStep },
  ): Promise<Map<LegalDocumentKind, KindSnapshot>> {
    const databaseNow = await this.repository.getDatabaseNow();
    progress.step = 'published_versions';
    const records = await this.repository.listPublishedVersions(kinds, databaseNow);
    progress.step = 'version_rows';
    const monotonicMs = performance.now();
    const versionsByKind = new Map<LegalDocumentKind, LegalVersion[]>(
      kinds.map((kind) => [kind, []]),
    );
    for (const record of records) {
      versionsByKind.get(record.kind)?.push(toLegalVersion(record));
    }
    return new Map(
      [...versionsByKind].map(([kind, versions]) => [kind, { versions, databaseNow, monotonicMs }]),
    );
  }

  /** One read outcome per request, after the response is decided. */
  record(endpoint: LegalReadEndpoint, source: LegalReadSource, outcome: LegalReadOutcome): void {
    this.metrics.incrementCounter({
      name: LEGAL_DOCUMENT_READS_METRIC,
      labels: { endpoint, source, outcome },
    });
  }

  private answer(
    endpoint: LegalReadEndpoint,
    source: LegalReadSource,
    snapshots: ReadonlyMap<LegalDocumentKind, KindSnapshot>,
  ): LegalPublishedRead {
    const snapshotOf = (kind: LegalDocumentKind) => {
      const snapshot = snapshots.get(kind);
      if (!snapshot) {
        throw new Error(`[LegalPublishedVersionReader] ${kind} was not read`);
      }
      return snapshot;
    };
    return {
      endpoint,
      source,
      versionsOf: (kind) => snapshotOf(kind).versions,
      nowOf: (kind) => {
        const snapshot = snapshotOf(kind);
        if (source === 'database') {
          return snapshot.databaseNow;
        }
        const elapsedMs = Math.max(0, performance.now() - snapshot.monotonicMs);
        return new Date(snapshot.databaseNow.getTime() + elapsedMs);
      },
    };
  }
}

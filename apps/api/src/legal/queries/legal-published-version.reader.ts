import { Inject, Injectable } from '@nestjs/common';
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
 * a scheduled version still takes effect on time; with nothing in memory it fails with 503. Versions
 * change only through an approval, which needs the database, so a memory answer stays correct
 * (single user API instance, docs/architecture/backend/runtime-composition-and-process-state.md).
 */
@Injectable()
export class LegalPublishedVersionReader {
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
    try {
      const databaseNow = await this.repository.getDatabaseNow();
      const records = await this.repository.listPublishedVersions(kinds, databaseNow);
      const monotonicMs = performance.now();
      const versionsByKind = new Map<LegalDocumentKind, LegalVersion[]>(
        kinds.map((kind) => [kind, []]),
      );
      for (const record of records) {
        versionsByKind.get(record.kind)?.push(toLegalVersion(record));
      }
      fresh = new Map(
        [...versionsByKind].map(([kind, versions]) => [
          kind,
          { versions, databaseNow, monotonicMs },
        ]),
      );
    } catch {
      fresh = null;
    }

    if (fresh) {
      for (const [kind, snapshot] of fresh) {
        this.snapshots.set(kind, snapshot);
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

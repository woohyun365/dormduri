import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import observabilityConfig from '../observability.config.js';
import type { DomainMetricsPort } from './domain-metrics.port.js';
import { DOMAIN_METRICS_PORT, recordDomainMetricSafely } from './domain-metrics.port.js';

export interface PrismaPoolMetricSnapshot {
  readonly total: number;
  readonly idle: number;
  readonly waiting: number;
}

export interface PrismaPoolMetricProvider {
  snapshotPoolMetrics(): PrismaPoolMetricSnapshot;
}

export type PrismaTransactionRetryMetricOutcome = 'retry' | 'exhausted';

@Injectable()
export class PrismaPoolMetricsService {
  private readonly poolProviders = new Set<PrismaPoolMetricProvider>();

  constructor(
    @Inject(DOMAIN_METRICS_PORT)
    private readonly domainMetrics: DomainMetricsPort,
    @Inject(observabilityConfig.KEY)
    private readonly settings: ConfigType<typeof observabilityConfig>,
  ) {}

  registerPool(provider: PrismaPoolMetricProvider): () => void {
    this.poolProviders.add(provider);
    this.recordPoolSnapshot();

    return () => {
      this.poolProviders.delete(provider);
      this.recordPoolSnapshot();
    };
  }

  recordPoolSnapshot(): void {
    if (!this.settings.metricsEnabled) {
      return;
    }

    const totals = { total: 0, idle: 0, waiting: 0 };
    for (const provider of this.poolProviders) {
      const snapshot = provider.snapshotPoolMetrics();
      totals.total += Math.max(0, snapshot.total);
      totals.idle += Math.max(0, snapshot.idle);
      totals.waiting += Math.max(0, snapshot.waiting);
    }

    for (const [state, value] of Object.entries(totals)) {
      recordDomainMetricSafely(this.domainMetrics, (metrics) =>
        metrics.setGauge({
          name: 'api_prisma_pool_connections',
          labels: { state },
          value,
        }),
      );
    }
  }

  recordSerializableTransactionRetry(outcome: PrismaTransactionRetryMetricOutcome): void {
    recordDomainMetricSafely(this.domainMetrics, (metrics) =>
      metrics.incrementCounter({
        name: 'api_prisma_transaction_retries_total',
        labels: { outcome },
      }),
    );
  }
}

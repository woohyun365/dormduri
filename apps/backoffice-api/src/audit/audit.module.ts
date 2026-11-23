import { Module } from '@nestjs/common';
import {
  BACKOFFICE_SETTINGS,
  type BackofficeSettings,
} from '../platform/config/backoffice-settings.js';
import {
  BackofficeRetentionPrisma,
  BackofficeRuntimePrisma,
} from '../platform/database/backoffice-prisma.js';
import { BackofficeLogger } from '../platform/observability/backoffice-logger.js';
import { BackofficeMetrics } from '../platform/observability/backoffice-metrics.js';
import { AdminAuditQueryService } from './admin-audit-query.service.js';
import { AdminAuditWriter } from './admin-audit-writer.js';
import { AuditController } from './audit.controller.js';
import { AdminRecordsRetention } from './retention/admin-records-retention.js';
import { AdminRecordsRetentionScheduler } from './retention/admin-records-retention.scheduler.js';

/** Audit rows, the monthly review record and the backoffice records cleanup job. */
@Module({
  controllers: [AuditController],
  providers: [
    {
      provide: AdminAuditWriter,
      useFactory: (metrics: BackofficeMetrics) => new AdminAuditWriter(metrics),
      inject: [BackofficeMetrics],
    },
    {
      provide: AdminAuditQueryService,
      useFactory: (prisma: BackofficeRuntimePrisma, audit: AdminAuditWriter) =>
        new AdminAuditQueryService(prisma, audit),
      inject: [BackofficeRuntimePrisma, AdminAuditWriter],
    },
    {
      provide: AdminRecordsRetention,
      useFactory: (
        prisma: BackofficeRetentionPrisma,
        metrics: BackofficeMetrics,
        logger: BackofficeLogger,
      ) => new AdminRecordsRetention(prisma, metrics, logger),
      inject: [BackofficeRetentionPrisma, BackofficeMetrics, BackofficeLogger],
    },
    {
      provide: AdminRecordsRetentionScheduler,
      useFactory: (retention: AdminRecordsRetention, settings: BackofficeSettings) =>
        new AdminRecordsRetentionScheduler(retention, settings.retentionJob),
      inject: [AdminRecordsRetention, BACKOFFICE_SETTINGS],
    },
  ],
  exports: [AdminAuditWriter, AdminRecordsRetention],
})
export class AuditModule {}

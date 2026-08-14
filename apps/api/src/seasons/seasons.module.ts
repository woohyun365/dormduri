import { Module } from '@nestjs/common';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { DomainMetricDefinitionsModule } from '../platform/observability/metrics/domain-metric-definitions.module.js';
import { SeasonsController } from './seasons.controller.js';
import { SeasonsService } from './application/seasons.service.js';
import { SEASON_CONTEXT_PORT } from './ports/season-context.port.js';
import { ClearSeasonOverrideCommand } from './operations/clear-season-override.command.js';
import { SeasonOperationalMetricsService } from './operations/season-operational-metrics.service.js';
import { SEASON_METRIC_DEFINITIONS } from './operations/season-metric.definitions.js';
import { SeasonOperationsAuditRepository } from './operations/season-operations-audit.repository.js';
import { SeasonOperationsRepository } from './operations/season-operations.repository.js';
import { SeasonsOperationsController } from './operations/seasons-operations.controller.js';
import { UpdateSeasonOverrideCommand } from './operations/update-season-override.command.js';
import { UpdateSeasonScheduleCommand } from './operations/update-season-schedule.command.js';
import { CurrentSeasonContextQuery } from './runtime/current-season-context.query.js';
import { DormitoryMatchWindowQuery } from './runtime/dormitory-match-window.query.js';
import { SeasonRuntimeRepository } from './runtime/season-runtime.repository.js';

@Module({
  imports: [
    PrismaModule,
    DomainMetricDefinitionsModule.register('seasons', SEASON_METRIC_DEFINITIONS),
  ],
  controllers: [SeasonsController, SeasonsOperationsController],
  providers: [
    SeasonsService,
    SeasonRuntimeRepository,
    CurrentSeasonContextQuery,
    DormitoryMatchWindowQuery,
    SeasonOperationsRepository,
    SeasonOperationsAuditRepository,
    SeasonOperationalMetricsService,
    UpdateSeasonScheduleCommand,
    UpdateSeasonOverrideCommand,
    ClearSeasonOverrideCommand,
    { provide: SEASON_CONTEXT_PORT, useExisting: SeasonsService },
  ],
  exports: [SEASON_CONTEXT_PORT],
})
export class SeasonsModule {}

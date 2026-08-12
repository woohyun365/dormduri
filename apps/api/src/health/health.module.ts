import { Module } from '@nestjs/common';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { AppLoggerModule } from '../platform/observability/logging/app-logger.module.js';
import { DomainMetricDefinitionsModule } from '../platform/observability/metrics/domain-metric-definitions.module.js';
import { DatabaseHealthCheck } from './checks/database-health.check.js';
import { RuntimeBootstrapHealthCheck } from './checks/runtime-bootstrap-health.check.js';
import { HealthController } from './health.controller.js';
import { HealthObservabilityService } from './health-observability.service.js';
import { HealthService } from './health.service.js';
import { HEALTH_METRIC_DEFINITIONS } from './health-metric.definitions.js';

@Module({
  imports: [
    PrismaModule,
    AppLoggerModule,
    DomainMetricDefinitionsModule.register('health', HEALTH_METRIC_DEFINITIONS),
  ],
  controllers: [HealthController],
  providers: [
    DatabaseHealthCheck,
    RuntimeBootstrapHealthCheck,
    HealthObservabilityService,
    HealthService,
  ],
})
export class HealthModule {}

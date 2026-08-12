import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DOMAIN_METRICS_PORT } from './domain-metrics.port.js';
import { DomainPrometheusMetricsService } from './domain-prometheus-metrics.service.js';
import { MetricsAuthGuard } from './metrics-auth.guard.js';
import { MetricsController } from './metrics.controller.js';
import { PrometheusRegistryService } from './prometheus-registry.service.js';
import { HttpMetricsInterceptor } from './http-metrics.interceptor.js';
import { HttpMetricsService } from './http-metrics.service.js';
import { PrismaPoolMetricsService } from './prisma-pool-metrics.service.js';
import { DomainMetricDefinitionRegistryService } from './domain-metric-definition-registry.service.js';

@Module({
  controllers: [MetricsController],
  providers: [
    MetricsAuthGuard,
    PrometheusRegistryService,
    HttpMetricsService,
    DomainMetricDefinitionRegistryService,
    DomainPrometheusMetricsService,
    PrismaPoolMetricsService,
    {
      provide: DOMAIN_METRICS_PORT,
      useExisting: DomainPrometheusMetricsService,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
  ],
  exports: [
    PrometheusRegistryService,
    HttpMetricsService,
    DomainMetricDefinitionRegistryService,
    DomainPrometheusMetricsService,
    PrismaPoolMetricsService,
    DOMAIN_METRICS_PORT,
  ],
})
export class MetricsModule {}

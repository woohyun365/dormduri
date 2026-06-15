import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsAuthGuard } from './metrics-auth.guard.js';
import { MetricsController } from './metrics.controller.js';
import { PrometheusRegistryService } from './prometheus-registry.service.js';
import { HttpMetricsInterceptor } from './http-metrics.interceptor.js';
import { HttpMetricsService } from './http-metrics.service.js';

@Module({
  controllers: [MetricsController],
  providers: [
    MetricsAuthGuard,
    PrometheusRegistryService,
    HttpMetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
  ],
  exports: [PrometheusRegistryService, HttpMetricsService],
})
export class MetricsModule {}

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppLoggerModule } from './logging/app-logger.module.js';
import { MetricsModule } from './metrics/metrics.module.js';
import { RequestContextMiddleware } from './logging/request-context.middleware.js';
import { RequestLoggingInterceptor } from './logging/request-logging.interceptor.js';

@Module({
  imports: [AppLoggerModule, MetricsModule],
  providers: [
    RequestContextMiddleware,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
  ],
  exports: [AppLoggerModule, MetricsModule],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}

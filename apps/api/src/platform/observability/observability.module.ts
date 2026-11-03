import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppLoggerModule } from './logging/app-logger.module.js';
import { MetricsModule } from './metrics/metrics.module.js';
import { RequestContextMiddleware } from './logging/request-context.middleware.js';
import { RequestLoggingInterceptor } from './logging/request-logging.interceptor.js';
import { RequestRouteTemplateGuard } from './logging/request-route-template.guard.js';

@Module({
  imports: [AppLoggerModule, MetricsModule],
  providers: [
    RequestContextMiddleware,
    // AppModule imports this module before AuthModule, so this global guard runs before the
    // auth guards and their rejections are logged with the route template.
    {
      provide: APP_GUARD,
      useClass: RequestRouteTemplateGuard,
    },
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

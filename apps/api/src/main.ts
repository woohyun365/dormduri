import type { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import appConfig from './config/app.config.js';
import httpConfig from './config/http.config.js';
import { AppLoggerService } from './platform/observability/logging/app-logger.service.js';
import { configureHttpRuntime } from './platform/http/http-runtime.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(AppLoggerService));
  const appSettings = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  const httpSettings = app.get<ConfigType<typeof httpConfig>>(httpConfig.KEY);
  configureHttpRuntime(app, httpSettings);
  app.enableShutdownHooks();
  await app.listen(appSettings.port);
}
await bootstrap();

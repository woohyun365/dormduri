import type { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import type { Express } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import appConfig from './config/app.config.js';
import { AppLoggerService } from './platform/observability/logging/app-logger.service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(AppLoggerService));
  const expressApp = app.getHttpAdapter().getInstance() as Express;
  const appSettings = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  expressApp.set('trust proxy', true);
  app.use(helmet());
  app.use(cookieParser());
  app.enableShutdownHooks();
  await app.listen(appSettings.port);
}
await bootstrap();

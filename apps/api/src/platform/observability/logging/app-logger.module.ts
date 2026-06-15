import { Module } from '@nestjs/common';
import { AppLoggerService } from './app-logger.service.js';
import { RequestContextService } from './request-context.service.js';

@Module({
  providers: [AppLoggerService, RequestContextService],
  exports: [AppLoggerService, RequestContextService],
})
export class AppLoggerModule {}

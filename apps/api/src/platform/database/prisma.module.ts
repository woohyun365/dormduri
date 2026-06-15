import { Global, Module } from '@nestjs/common';
import {
  PrismaService,
  RetentionDisclosurePrismaService,
  RetentionWorkerPrismaService,
} from './prisma.service.js';
import { AppLoggerModule } from '../observability/logging/app-logger.module.js';
import { MetricsModule } from '../observability/metrics/metrics.module.js';

@Global()
@Module({
  imports: [AppLoggerModule, MetricsModule],
  providers: [PrismaService, RetentionWorkerPrismaService, RetentionDisclosurePrismaService],
  exports: [PrismaService, RetentionWorkerPrismaService, RetentionDisclosurePrismaService],
})
export class PrismaModule {}

import { Global, Module } from '@nestjs/common';
import {
  PrismaService,
  RetentionDisclosurePrismaService,
  RetentionWorkerPrismaService,
} from './prisma.service.js';

@Global()
@Module({
  providers: [PrismaService, RetentionWorkerPrismaService, RetentionDisclosurePrismaService],
  exports: [PrismaService, RetentionWorkerPrismaService, RetentionDisclosurePrismaService],
})
export class PrismaModule {}

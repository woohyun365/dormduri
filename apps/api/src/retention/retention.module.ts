import { Module } from '@nestjs/common';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { RETENTION_EXPORTS } from './composition/retention.exports.js';
import { RETENTION_PROVIDERS } from './composition/retention.providers.js';

@Module({
  imports: [PrismaModule],
  providers: RETENTION_PROVIDERS,
  exports: RETENTION_EXPORTS,
})
export class RetentionModule {}

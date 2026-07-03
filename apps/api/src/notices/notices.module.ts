import { Module } from '@nestjs/common';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { NOTICES_EXPORTS } from './composition/notices.exports.js';
import { NOTICES_PROVIDERS } from './composition/notices.providers.js';
import { NoticesController } from './notices.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [NoticesController],
  providers: NOTICES_PROVIDERS,
  exports: NOTICES_EXPORTS,
})
export class NoticesModule {}

import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { SUPPORT_EXPORTS } from './composition/support.exports.js';
import { SUPPORT_PROVIDERS } from './composition/support.providers.js';
import { SupportController } from './support.controller.js';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [SupportController],
  providers: SUPPORT_PROVIDERS,
  exports: SUPPORT_EXPORTS,
})
export class SupportModule {}

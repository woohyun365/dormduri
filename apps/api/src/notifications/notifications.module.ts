import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { BackgroundJobsModule } from '../background-jobs/background-jobs.module.js';
import { NotificationsController } from './notifications.controller.js';
import { NOTIFICATIONS_EXPORTS } from './composition/notifications.exports.js';
import { NOTIFICATIONS_PROVIDERS } from './composition/notifications.providers.js';

@Module({
  imports: [PrismaModule, BackgroundJobsModule, AuthModule],
  controllers: [NotificationsController],
  providers: NOTIFICATIONS_PROVIDERS,
  exports: NOTIFICATIONS_EXPORTS,
})
export class NotificationsModule {}

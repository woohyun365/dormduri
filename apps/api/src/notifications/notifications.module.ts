import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { CreateChatThreadNotificationCommand } from './commands/create-chat-thread-notification.command.js';
import { CHAT_THREAD_NOTIFICATION_WRITER } from './notifications.tokens.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationQueryService } from './queries/notification-query.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationQueryService,
    CreateChatThreadNotificationCommand,
    {
      provide: CHAT_THREAD_NOTIFICATION_WRITER,
      useExisting: CreateChatThreadNotificationCommand,
    },
  ],
  exports: [NotificationsService, NotificationQueryService, CHAT_THREAD_NOTIFICATION_WRITER],
})
export class NotificationsModule {}

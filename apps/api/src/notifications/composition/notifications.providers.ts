import type { Provider } from '@nestjs/common';
import { NotificationsService } from '../application/notifications.service.js';
import { CHAT_THREAD_NOTIFICATION_WRITER } from '../application/ports/chat-thread-notification-writer.port.js';
import { NOTIFICATION_WRITER } from '../application/ports/notification-writer.port.js';
import { CreateChatThreadNotificationCommand } from '../commands/create-chat-thread-notification.command.js';
import { CreateNotificationCommand } from '../commands/create-notification.command.js';
import { NotificationOutboxDispatcherService } from '../outbox/notification-dispatcher.service.js';
import { NotificationQueryService } from '../queries/notification-query.service.js';

export const NOTIFICATIONS_APPLICATION_PROVIDERS: Provider[] = [
  NotificationsService,
  NotificationQueryService,
];

export const NOTIFICATIONS_WRITER_PROVIDERS: Provider[] = [
  CreateNotificationCommand,
  CreateChatThreadNotificationCommand,
  {
    provide: NOTIFICATION_WRITER,
    useExisting: CreateNotificationCommand,
  },
  {
    provide: CHAT_THREAD_NOTIFICATION_WRITER,
    useExisting: CreateChatThreadNotificationCommand,
  },
];

export const NOTIFICATIONS_PROVIDERS: Provider[] = [
  ...NOTIFICATIONS_APPLICATION_PROVIDERS,
  ...NOTIFICATIONS_WRITER_PROVIDERS,
];

// The dispatcher is hosted by the chat realtime module until notification realtime
// publisher ownership is extracted. Import this composition provider instead of
// importing outbox internals from external modules.
export const NOTIFICATION_OUTBOX_DISPATCHER_PROVIDERS: Provider[] = [
  NotificationOutboxDispatcherService,
];

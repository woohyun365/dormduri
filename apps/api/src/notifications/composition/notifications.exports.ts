import { CHAT_THREAD_NOTIFICATION_WRITER } from '../application/ports/chat-thread-notification-writer.port.js';
import { NOTIFICATION_WRITER } from '../application/ports/notification-writer.port.js';
import { NotificationQueryService } from '../queries/notification-query.service.js';

export const NOTIFICATIONS_EXPORTS = [
  NotificationQueryService,
  NOTIFICATION_WRITER,
  CHAT_THREAD_NOTIFICATION_WRITER,
];

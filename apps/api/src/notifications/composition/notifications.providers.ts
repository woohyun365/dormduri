import type { Provider } from '@nestjs/common';
import { NotificationsService } from '../application/notifications.service.js';
import { CHAT_THREAD_NOTIFICATION_WRITER } from '../application/ports/chat-thread-notification-writer.port.js';
import { NOTIFICATION_WRITER } from '../application/ports/notification-writer.port.js';
import { CreateChatThreadNotificationCommand } from '../commands/create-chat-thread-notification.command.js';
import { CreateNotificationCommand } from '../commands/create-notification.command.js';
import { MaterializeProfileMismatchFeedbackCommand } from '../commands/materialize-profile-mismatch-feedback.command.js';
import { MaterializeReportOperatorAlertCommand } from '../commands/materialize-report-operator-alert.command.js';
import { CreateNotificationCampaignCommand } from '../campaigns/create-notification-campaign.command.js';
import { NotificationCampaignFanoutService } from '../campaigns/notification-campaign-fanout.service.js';
import { LoggerOperatorAlertSink } from '../operator-alerts/logger-operator-alert.sink.js';
import { OPERATOR_ALERT_SINK } from '../operator-alerts/operator-alert-sink.port.js';
import { NotificationOutboxDispatcherService } from '../outbox/notification-dispatcher.service.js';
import { NotificationQueryService } from '../queries/notification-query.service.js';

export const NOTIFICATIONS_APPLICATION_PROVIDERS: Provider[] = [
  NotificationsService,
  NotificationQueryService,
];

export const NOTIFICATIONS_WRITER_PROVIDERS: Provider[] = [
  CreateNotificationCommand,
  CreateChatThreadNotificationCommand,
  MaterializeProfileMismatchFeedbackCommand,
  MaterializeReportOperatorAlertCommand,
  CreateNotificationCampaignCommand,
  NotificationCampaignFanoutService,
  LoggerOperatorAlertSink,
  {
    provide: NOTIFICATION_WRITER,
    useExisting: CreateNotificationCommand,
  },
  {
    provide: CHAT_THREAD_NOTIFICATION_WRITER,
    useExisting: CreateChatThreadNotificationCommand,
  },
  {
    provide: OPERATOR_ALERT_SINK,
    useExisting: LoggerOperatorAlertSink,
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

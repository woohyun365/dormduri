import { CHAT_THREAD_NOTIFICATION_WRITER } from '../application/ports/chat-thread-notification-writer.port.js';
import { NOTIFICATION_WRITER } from '../application/ports/notification-writer.port.js';
import { NotificationQueryService } from '../queries/notification-query.service.js';
import { MaterializeProfileMismatchFeedbackCommand } from '../commands/materialize-profile-mismatch-feedback.command.js';
import { MaterializeReportOperatorAlertCommand } from '../commands/materialize-report-operator-alert.command.js';
import { CreateNotificationCampaignCommand } from '../campaigns/create-notification-campaign.command.js';
import { NotificationCampaignFanoutService } from '../campaigns/notification-campaign-fanout.service.js';

export const NOTIFICATIONS_EXPORTS = [
  NotificationQueryService,
  NOTIFICATION_WRITER,
  CHAT_THREAD_NOTIFICATION_WRITER,
  MaterializeProfileMismatchFeedbackCommand,
  MaterializeReportOperatorAlertCommand,
  CreateNotificationCampaignCommand,
  NotificationCampaignFanoutService,
];

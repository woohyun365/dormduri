import { Injectable } from '@nestjs/common';
import type {
  ListNotificationsQuery,
  MarkNotificationReadResponse,
  NotificationListResponse,
  NotificationUnreadCountResponse,
} from '@repo/shared/notification-contract';
import type { AuthenticatedUserContext } from '../auth/application/auth-actor-context.types.js';
import { NotificationQueryService } from './queries/notification-query.service.js';

@Injectable()
export class NotificationsService {
  constructor(private readonly queryService: NotificationQueryService) {}

  listNotifications(
    authUser: AuthenticatedUserContext,
    input: ListNotificationsQuery = {},
  ): Promise<NotificationListResponse> {
    return this.queryService.listNotifications(authUser.id, input);
  }

  getUnreadCount(authUser: AuthenticatedUserContext): Promise<NotificationUnreadCountResponse> {
    return this.queryService.getUnreadCount(authUser.id);
  }

  markRead(
    authUser: AuthenticatedUserContext,
    notificationId: string,
  ): Promise<MarkNotificationReadResponse> {
    return this.queryService.markRead(authUser.id, notificationId);
  }
}

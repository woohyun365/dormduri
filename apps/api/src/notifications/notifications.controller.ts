import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator.js';
import { AuthenticatedUserGuard } from '../auth/authenticated-user.guard.js';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { NotificationsService } from './notifications.service.js';

function parseNotificationListLimit(rawLimit: string | undefined): number | undefined {
  if (rawLimit === undefined) {
    return undefined;
  }

  const limit = Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new BadRequestException({
      code: 'INVALID_QUERY',
      fieldErrors: {
        limit: ['limit must be an integer between 1 and 50'],
      },
    });
  }

  return limit;
}

@Controller('api/notifications')
@UseGuards(AuthenticatedUserGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async listNotifications(
    @AuthenticatedUser() authUser: AuthenticatedUserContext,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.notificationsService.listNotifications(authUser, {
      limit: parseNotificationListLimit(limit),
      cursor: cursor && cursor.trim().length > 0 ? cursor.trim() : null,
    });
  }

  @Get('unread-count')
  async getUnreadCount(@AuthenticatedUser() authUser: AuthenticatedUserContext) {
    return this.notificationsService.getUnreadCount(authUser);
  }

  @Post(':notificationId/read')
  async markRead(
    @AuthenticatedUser() authUser: AuthenticatedUserContext,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationsService.markRead(authUser, notificationId);
  }
}

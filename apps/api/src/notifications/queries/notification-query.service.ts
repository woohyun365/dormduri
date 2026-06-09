import { Injectable } from '@nestjs/common';
import type {
  ListNotificationsQuery,
  MarkAllNotificationsReadResponse,
  MarkNotificationReadResponse,
  NotificationListResponse,
  NotificationUnreadCountResponse,
} from '@repo/shared/notifications';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { notificationErrors } from '../errors/notification.errors.js';
import {
  toUserNotification,
  type UserNotificationRecord,
} from '../mappers/notification-presenter.js';
import {
  createNotificationListCursorOwner,
  type NotificationListCursorBoundary,
} from './notification-list-cursor.js';

@Injectable()
export class NotificationQueryService {
  constructor(private readonly prisma: PrismaService) {}

  private get cursorOwner() {
    return createNotificationListCursorOwner();
  }

  async listNotifications(
    userId: string,
    input: ListNotificationsQuery = {},
  ): Promise<NotificationListResponse> {
    const now = await this.prisma.getDatabaseNow();
    const limit = input.limit ?? 20;
    let after: NotificationListCursorBoundary | null = null;

    if (input.cursor) {
      try {
        after = this.cursorOwner.verifyCursor({ cursor: input.cursor, viewerUserId: userId, now });
      } catch {
        throw notificationErrors.invalidListCursor();
      }
    }

    const rows = await this.prisma.userNotification.findMany({
      where: {
        recipientUserId: userId,
        ...(after
          ? {
              OR: [
                { createdAt: { lt: after.createdAt } },
                { createdAt: after.createdAt, id: { lt: after.notificationId } },
              ],
            }
          : {}),
      },
      select: notificationSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const page = rows.slice(0, limit);
    const last = page.at(-1) ?? null;
    const nextCursor =
      rows.length > limit && last
        ? this.cursorOwner.signCursor({
            viewerUserId: userId,
            after: { createdAt: last.createdAt, notificationId: last.id },
            now,
          })
        : null;

    return {
      items: page.map((row) => toUserNotification(row)),
      pageInfo: {
        hasNextPage: rows.length > limit,
        nextCursor,
      },
    };
  }

  async getUnreadCount(userId: string): Promise<NotificationUnreadCountResponse> {
    const unreadCount = await this.prisma.userNotification.count({
      where: { recipientUserId: userId, readAt: null },
    });
    return { unreadCount };
  }

  async markRead(userId: string, notificationId: string): Promise<MarkNotificationReadResponse> {
    const now = await this.prisma.getDatabaseNow();
    await this.prisma.userNotification.updateMany({
      where: { id: notificationId, recipientUserId: userId, readAt: null },
      data: { readAt: now, updatedAt: now },
    });

    const notification = await this.prisma.userNotification.findFirst({
      where: { id: notificationId, recipientUserId: userId },
      select: notificationSelect,
    });
    if (!notification) {
      throw notificationErrors.notificationNotFound();
    }

    return { notification: toUserNotification(notification) };
  }

  async markAllRead(userId: string): Promise<MarkAllNotificationsReadResponse> {
    const now = await this.prisma.getDatabaseNow();
    const result = await this.prisma.userNotification.updateMany({
      where: { recipientUserId: userId, readAt: null },
      data: { readAt: now, updatedAt: now },
    });

    return { updatedCount: result.count, readAt: now.toISOString() };
  }
}

const notificationSelect = {
  id: true,
  recipientUserId: true,
  actorUserId: true,
  kind: true,
  sourceType: true,
  sourceId: true,
  payload: true,
  readAt: true,
  createdAt: true,
} as const satisfies Record<keyof UserNotificationRecord, true>;

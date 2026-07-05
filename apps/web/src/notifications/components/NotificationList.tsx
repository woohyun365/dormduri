import { Inbox } from 'lucide-react';
import type { NotificationDisplay } from '../model/notificationCopy.mapper';
import { NotificationListItem } from './NotificationListItem';

export function NotificationList({
  notifications,
  markingId,
  onMarkRead,
}: {
  notifications: NotificationDisplay[];
  markingId: string | null;
  onMarkRead: (notificationId: string) => void;
}) {
  if (notifications.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-(--knu-border) bg-white p-6 text-center shadow-sm">
        <Inbox className="mx-auto size-8 text-(--knu-text-tertiary)" aria-hidden="true" />
        <p className="mt-3 text-sm font-extrabold text-(--knu-text-primary)">
          확인할 알림이 없어요.
        </p>
        <p className="mt-1 text-xs leading-relaxed text-(--knu-text-secondary)">
          시즌, 문의, 신고 처리 상태가 바뀌면 이곳에 표시돼요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" aria-label="알림 목록">
      {notifications.map((notification) => (
        <NotificationListItem
          key={notification.id}
          notification={notification}
          marking={markingId === notification.id}
          onMarkRead={onMarkRead}
        />
      ))}
    </div>
  );
}

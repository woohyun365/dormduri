import type { Route } from 'next';
import Link from 'next/link';
import { Bell } from 'lucide-react';

function formatUnreadHelper(unreadNotificationCount: number | null, loadingUnreadCount: boolean) {
  if (loadingUnreadCount) return '새 알림을 확인하는 중이에요.';
  if (unreadNotificationCount === null) return '새 알림은 알림함에서 확인할 수 있어요.';
  return `읽지 않은 알림 ${unreadNotificationCount}개`;
}

export function NotificationInboxPreview({
  unreadNotificationCount,
  loadingUnreadCount,
}: {
  unreadNotificationCount: number | null;
  loadingUnreadCount: boolean;
}) {
  return (
    <Link
      href={'/notifications' as Route}
      className="block rounded-2xl border border-purple-100 bg-purple-50/45 p-3 transition-colors hover:bg-purple-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
    >
      <span className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-700">
            <Bell className="size-4" aria-hidden="true" />
            {unreadNotificationCount !== null && unreadNotificationCount > 0 && (
              <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-purple-600 px-1 text-[10px] font-black leading-4 text-white">
                {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
              </span>
            )}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-extrabold text-(--knu-text-primary)">알림함</span>
            <span className="block text-[11px] text-(--knu-text-tertiary)">
              {formatUnreadHelper(unreadNotificationCount, loadingUnreadCount)}
            </span>
          </span>
        </span>
        <span className="shrink-0 text-[11px] font-extrabold text-purple-700">전체 보기</span>
      </span>
    </Link>
  );
}

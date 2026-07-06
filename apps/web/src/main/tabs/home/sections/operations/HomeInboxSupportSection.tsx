import { NotificationInboxPreview } from './NotificationInboxPreview';
import { SupportCenterEntry } from './SupportCenterEntry';

export function HomeInboxSupportSection({
  unreadNotificationCount,
  loadingUnreadCount,
}: {
  unreadNotificationCount: number | null;
  loadingUnreadCount: boolean;
}) {
  return (
    <div aria-label="알림함과 문의하기" className="space-y-3">
      <NotificationInboxPreview
        unreadNotificationCount={unreadNotificationCount}
        loadingUnreadCount={loadingUnreadCount}
      />
      <SupportCenterEntry />
    </div>
  );
}

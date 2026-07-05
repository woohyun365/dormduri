import { RefreshCw } from 'lucide-react';
import type { SupportFaqItem } from '@repo/shared/support';
import type {
  HomeNotificationPreview,
  HomeSupportTicketPreview,
} from '../../model/operations/homeOperationsViewModel';
import { NotificationInboxPreview } from './NotificationInboxPreview';
import { SupportCenterEntry } from './SupportCenterEntry';
import { SupportTicketListPreview } from './SupportTicketListPreview';

type FeedStatus = 'idle' | 'loading' | 'success' | 'error';

export function HomeInboxSupportSection({
  notifications,
  unreadCount,
  notificationStatus,
  notificationError,
  supportStatus,
  supportError,
  faqs,
  tickets,
  allFeedsFailed,
  onRetry,
}: {
  notifications: HomeNotificationPreview[];
  unreadCount: number;
  notificationStatus: FeedStatus;
  notificationError?: string;
  supportStatus: FeedStatus;
  supportError?: string;
  faqs: SupportFaqItem[];
  tickets: HomeSupportTicketPreview[];
  allFeedsFailed: boolean;
  onRetry: () => void;
}) {
  return (
    <div aria-label="알림함과 문의하기" className="space-y-3">
      {allFeedsFailed && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-bold text-amber-800">
            알림과 문의 정보를 불러오지 못했어요. 홈의 다른 기능은 계속 사용할 수 있어요.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-amber-800 shadow-sm transition-colors hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          >
            <RefreshCw className="size-3" aria-hidden="true" />
            다시 시도
          </button>
        </div>
      )}

      <NotificationInboxPreview
        notifications={notifications}
        unreadCount={unreadCount}
        status={notificationStatus}
        error={notificationError}
        onRetry={onRetry}
      />

      <SupportCenterEntry
        faqs={faqs}
        status={supportStatus}
        error={supportError}
        onRetry={onRetry}
      />

      <SupportTicketListPreview tickets={tickets} />
    </div>
  );
}

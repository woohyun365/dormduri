import { Bell, CheckCheck, Circle } from 'lucide-react';
import type { HomeNotificationPreview } from '../../model/operations/homeOperationsViewModel';
import { OperationsPanelErrorState } from './OperationsPanelErrorState';

function formatNotificationHelper(notification: HomeNotificationPreview) {
  if (notification.sourceType === 'SUPPORT_TICKET') return '문의 내역에서 확인할 수 있어요.';
  if (notification.sourceType === 'CONVERSATION_THREAD')
    return '대화 탭에서 이어서 확인할 수 있어요.';
  if (notification.sourceType === 'REPORT_CASE') return '신고 처리 상태가 업데이트됐어요.';
  return '필요한 내용을 확인해주세요.';
}

export function NotificationInboxPreview({
  notifications,
  unreadCount,
  status,
  error,
  onOpenSupportTicket,
  onMarkRead,
  onMarkAllRead,
  onRetry,
}: {
  notifications: HomeNotificationPreview[];
  unreadCount: number;
  status: 'idle' | 'loading' | 'success' | 'error';
  error?: string;
  onOpenSupportTicket: (notification: HomeNotificationPreview) => void;
  onMarkRead: (notification: HomeNotificationPreview) => void;
  onMarkAllRead: () => void;
  onRetry: () => void;
}) {
  if (status === 'error') {
    return (
      <OperationsPanelErrorState
        message={error ?? '알림함을 불러오지 못했어요.'}
        onRetry={onRetry}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-purple-100 bg-purple-50/45 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-700">
            <Bell className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-(--knu-text-primary)">알림함</p>
            <p className="text-[11px] text-(--knu-text-tertiary)">읽지 않은 알림 {unreadCount}개</p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-purple-700 shadow-sm transition-colors hover:bg-purple-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
          >
            <CheckCheck className="size-3" aria-hidden="true" />
            모두 읽음
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="rounded-xl bg-white/70 px-3 py-2 text-xs font-bold text-(--knu-text-secondary)">
          새 알림이 없어요.
        </p>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const buttonLabel = notification.supportTicketId
              ? `${notification.title} 문의 내역 열기`
              : `${notification.title} 읽음 처리`;
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => {
                  if (notification.supportTicketId) {
                    onOpenSupportTicket(notification);
                    return;
                  }
                  onMarkRead(notification);
                }}
                className="w-full rounded-xl bg-white/75 p-3 text-left transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
                aria-label={buttonLabel}
              >
                <span className="flex items-start gap-2">
                  <Circle
                    className={`mt-1 size-2.5 shrink-0 ${notification.read ? 'fill-slate-200 text-slate-200' : 'fill-purple-500 text-purple-500'}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-extrabold text-(--knu-text-primary)">
                      {notification.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-(--knu-text-tertiary)">
                      {formatNotificationHelper(notification)}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

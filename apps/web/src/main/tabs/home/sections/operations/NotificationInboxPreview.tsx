import type { Route } from 'next';
import Link from 'next/link';
import { Bell, Circle } from 'lucide-react';
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
  onRetry,
}: {
  notifications: HomeNotificationPreview[];
  unreadCount: number;
  status: 'idle' | 'loading' | 'success' | 'error';
  error?: string;
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
        <Link
          href={'/notifications' as Route}
          className="flex min-w-0 items-center gap-2 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-700">
            <Bell className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-extrabold text-(--knu-text-primary)">알림함</span>
            <span className="block text-[11px] text-(--knu-text-tertiary)">
              읽지 않은 알림 {unreadCount}개
            </span>
          </span>
        </Link>
        <Link
          href={'/notifications' as Route}
          className="shrink-0 text-[11px] font-extrabold text-purple-700"
        >
          전체 보기
        </Link>
      </div>

      {notifications.length === 0 ? (
        <p className="rounded-xl bg-white/70 px-3 py-2 text-xs font-bold text-(--knu-text-secondary)">
          새 알림이 없어요.
        </p>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const supportHref = notification.supportTicketId
              ? (`/support?ticketId=${encodeURIComponent(notification.supportTicketId)}` as Route)
              : null;
            const content = (
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
            );

            if (supportHref) {
              return (
                <Link
                  key={notification.id}
                  href={supportHref}
                  className="block w-full rounded-xl bg-white/75 p-3 text-left transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
                >
                  {content}
                </Link>
              );
            }

            return (
              <Link
                key={notification.id}
                href={'/notifications' as Route}
                className="block w-full rounded-xl bg-white/75 p-3 text-left transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
              >
                {content}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

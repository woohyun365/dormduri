import { Bell, CheckCheck } from 'lucide-react';

export type NotificationReadFilter = 'all' | 'unread';

export function NotificationFilterBar({
  unreadCount,
  filter,
  markingAll,
  onFilterChange,
  onMarkAllRead,
}: {
  unreadCount: number;
  filter: NotificationReadFilter;
  markingAll: boolean;
  onFilterChange: (filter: NotificationReadFilter) => void;
  onMarkAllRead: () => void;
}) {
  return (
    <div className="rounded-3xl border border-purple-100 bg-purple-50/60 p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-purple-100 text-purple-700">
            <Bell className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-black text-(--knu-text-primary)">알림함</h2>
            <p className="text-sm text-(--knu-text-secondary)">읽지 않은 알림 {unreadCount}개</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'unread'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onFilterChange(value)}
              className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500 ${
                filter === value ? 'bg-purple-600 text-white' : 'bg-white text-purple-700 shadow-sm'
              }`}
            >
              {value === 'all' ? '전체' : '읽지 않음'}
            </button>
          ))}
          <button
            type="button"
            onClick={onMarkAllRead}
            disabled={unreadCount === 0 || markingAll}
            className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-purple-700 shadow-sm transition-colors hover:bg-purple-100 disabled:cursor-not-allowed disabled:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
          >
            <CheckCheck className="size-3.5" aria-hidden="true" />
            모두 읽음
          </button>
        </div>
      </div>
    </div>
  );
}

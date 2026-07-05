import type { Route } from 'next';
import Link from 'next/link';
import { Bell, Circle, ExternalLink } from 'lucide-react';
import type { NotificationDisplay } from '../model/notificationCopy.mapper';

export function NotificationListItem({
  notification,
  marking,
  onMarkRead,
}: {
  notification: NotificationDisplay;
  marking: boolean;
  onMarkRead: (notificationId: string) => void;
}) {
  const supportHref = notification.supportTicketId
    ? (`/support?ticketId=${encodeURIComponent(notification.supportTicketId)}` as Route)
    : null;

  const content = (
    <span className="flex items-start gap-3">
      <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-2xl bg-purple-100 text-purple-700">
        <Bell className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <Circle
            className={`size-2.5 ${notification.read ? 'fill-slate-200 text-slate-200' : 'fill-purple-500 text-purple-500'}`}
            aria-hidden="true"
          />
          <span className="text-[11px] font-bold text-(--knu-text-tertiary)">
            {notification.createdAtLabel}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
            {notification.helper}
          </span>
        </span>
        <span className="mt-2 block text-sm font-extrabold text-(--knu-text-primary)">
          {notification.title}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-(--knu-text-secondary)">
          {notification.body}
        </span>
      </span>
      <ExternalLink
        className="mt-1 size-4 shrink-0 text-(--knu-text-tertiary)"
        aria-hidden="true"
      />
    </span>
  );

  if (supportHref) {
    return (
      <Link
        href={supportHref}
        onClick={() => {
          if (!notification.read) onMarkRead(notification.id);
        }}
        className="block rounded-3xl border border-(--knu-border) bg-white p-4 shadow-sm transition-colors hover:border-purple-200 hover:bg-purple-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={notification.read || marking}
      onClick={() => onMarkRead(notification.id)}
      className="block w-full rounded-3xl border border-(--knu-border) bg-white p-4 text-left shadow-sm transition-colors hover:border-purple-200 hover:bg-purple-50/40 disabled:cursor-default disabled:hover:border-(--knu-border) disabled:hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
    >
      {content}
    </button>
  );
}

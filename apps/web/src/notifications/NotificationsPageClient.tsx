'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { notificationsPageApi } from './api/notifications-page.api';
import {
  NotificationFilterBar,
  type NotificationReadFilter,
} from './components/NotificationFilterBar';
import { NotificationList } from './components/NotificationList';
import { toNotificationDisplay, type NotificationDisplay } from './model/notificationCopy.mapper';

type PageStatus = 'loading' | 'success' | 'error';

export default function NotificationsPageClient() {
  const [status, setStatus] = useState<PageStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<NotificationReadFilter>('all');
  const [notifications, setNotifications] = useState<NotificationDisplay[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const refresh = useCallback(async (isCancelled: () => boolean = () => false) => {
    setStatus('loading');
    setError(null);
    try {
      const [listResponse, unreadResponse] = await Promise.all([
        notificationsPageApi.listNotifications({ limit: 50 }),
        notificationsPageApi.getUnreadCount(),
      ]);
      if (isCancelled()) return;
      setNotifications(listResponse.items.map(toNotificationDisplay));
      setUnreadCount(unreadResponse.unreadCount);
      setStatus('success');
    } catch {
      if (isCancelled()) return;
      setStatus('error');
      setError('알림함을 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void refresh(() => cancelled);
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') return notifications.filter((notification) => !notification.read);
    return notifications;
  }, [filter, notifications]);

  async function handleMarkRead(notificationId: string) {
    setMarkingId(notificationId);
    try {
      const response = await notificationsPageApi.markRead(notificationId);
      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId ? toNotificationDisplay(response.notification) : item,
        ),
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } finally {
      setMarkingId(null);
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await notificationsPageApi.markAllRead();
      setNotifications((current) => current.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="min-h-screen bg-(--knu-background-alt)">
      <header className="sticky top-0 z-10 border-b border-(--knu-border) bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link
            href="/main"
            className="flex items-center gap-2 rounded-xl text-xl font-bold text-(--knu-text-primary)"
          >
            <Image
              src="/knu_logo.svg"
              alt="KNU 룸메 로고"
              width={36}
              height={36}
              className="rounded-xl"
            />
            <span>KNU 룸메</span>
          </Link>
          <Link
            href="/main"
            className="rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-(--knu-text-secondary) shadow-sm ring-1 ring-(--knu-border)"
          >
            홈으로
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8 md:py-12">
        <section className="rounded-3xl border border-purple-100 bg-linear-to-br from-purple-50 via-white to-violet-50 p-6 shadow-sm md:p-8">
          <p className="text-sm font-extrabold text-purple-700">알림함</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-(--knu-text-primary) md:text-4xl">
            내 알림을 한곳에서 확인해요
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-(--knu-text-secondary) md:text-base">
            자세한 내용을 확인할 수 있어요.
          </p>
        </section>

        <div className="mt-6">
          <NotificationFilterBar
            unreadCount={unreadCount}
            filter={filter}
            markingAll={markingAll}
            onFilterChange={setFilter}
            onMarkAllRead={() => void handleMarkAllRead()}
          />
        </div>

        {status === 'loading' && (
          <div className="mt-6 space-y-3" aria-label="알림함 로딩 중">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-24 animate-pulse rounded-3xl bg-white" />
            ))}
          </div>
        )}

        {status === 'error' && (
          <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
            {error}
            <button type="button" onClick={() => void refresh()} className="ml-3 underline">
              다시 시도
            </button>
          </div>
        )}

        {status === 'success' && (
          <div className="mt-6">
            <NotificationList
              notifications={filteredNotifications}
              markingId={markingId}
              onMarkRead={(notificationId) => void handleMarkRead(notificationId)}
            />
          </div>
        )}
      </main>
    </div>
  );
}

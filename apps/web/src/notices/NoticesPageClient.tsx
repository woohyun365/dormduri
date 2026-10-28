'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NoticeSeverity } from '@repo/shared/notices';
import { BrandLogo } from '@/screens/ui/brand';
import { noticesPageApi } from './api/notices-page.api';
import { NoticeArticle } from './components/NoticeArticle';
import { NoticeList } from './components/NoticeList';
import {
  NOTICE_SEVERITY_FILTERS,
  toNoticeArticleViewModel,
  toNoticeListItemViewModel,
  type NoticeArticleViewModel,
  type NoticeListItemViewModel,
} from './model/noticePageViewModel';

type PageStatus = 'loading' | 'success' | 'error';

export default function NoticesPageClient({
  initialNoticeId = null,
}: {
  initialNoticeId?: string | null;
}) {
  const [status, setStatus] = useState<PageStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<NoticeSeverity | 'ALL'>('ALL');
  const [notices, setNotices] = useState<NoticeListItemViewModel[]>([]);
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(initialNoticeId);
  const [selectedNotice, setSelectedNotice] = useState<NoticeArticleViewModel | null>(null);
  const [detailStatus, setDetailStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const selectedNoticeIdRef = useRef(selectedNoticeId);

  useEffect(() => {
    selectedNoticeIdRef.current = selectedNoticeId;
  }, [selectedNoticeId]);

  const loadNoticeList = useCallback(
    async (nextFilter: NoticeSeverity | 'ALL', isCancelled: () => boolean) => {
      setStatus('loading');
      setError(null);

      try {
        const response = await noticesPageApi.listNotices({
          limit: 20,
          severity: nextFilter === 'ALL' ? undefined : nextFilter,
        });
        if (isCancelled()) return;
        const items = response.items.map(toNoticeListItemViewModel);
        setNotices(items);
        setStatus('success');
        if (!selectedNoticeIdRef.current) {
          setSelectedNoticeId(items[0]?.id ?? null);
          setSelectedNotice(null);
        }
      } catch {
        if (isCancelled()) return;
        setStatus('error');
        setError('공지사항을 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void loadNoticeList(filter, () => cancelled);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [filter, loadNoticeList]);

  const loadNoticeDetail = useCallback(async (noticeId: string, isCancelled: () => boolean) => {
    setDetailStatus('loading');

    try {
      const response = await noticesPageApi.getNotice(noticeId);
      if (isCancelled()) return;
      setSelectedNotice(toNoticeArticleViewModel(response.notice));
      setDetailStatus('idle');
    } catch {
      if (isCancelled()) return;
      setSelectedNotice(null);
      setDetailStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!selectedNoticeId) return;
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void loadNoticeDetail(selectedNoticeId, () => cancelled);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [loadNoticeDetail, selectedNoticeId]);

  const selectedNoticeForDisplay = useMemo(() => {
    if (detailStatus !== 'idle') return null;
    return selectedNotice;
  }, [detailStatus, selectedNotice]);

  return (
    <div className="min-h-screen bg-(--knu-background-alt)">
      <header className="sticky top-0 z-10 border-b border-(--knu-border) bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link
            href="/main"
            className="flex items-center gap-2 rounded-xl text-xl font-bold text-(--knu-text-primary)"
          >
            <BrandLogo />
          </Link>
          <Link
            href="/main"
            className="rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-(--knu-text-secondary) shadow-sm ring-1 ring-(--knu-border)"
          >
            홈으로
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 md:py-12">
        <section className="rounded-3xl border border-blue-100 bg-linear-to-br from-blue-50 via-white to-sky-50 p-6 shadow-sm md:p-8">
          <p className="text-sm font-extrabold text-(--knu-primary)">공지사항</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-(--knu-text-primary) md:text-4xl">
            운영자가 공개한 안내를 확인해요
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-(--knu-text-secondary) md:text-base">
            전체 사용자에게 공개되는 운영 공지예요. 개인 알림이나 문의 답변은 알림함과 문의하기에서
            확인해주세요.
          </p>
        </section>

        <div className="mt-6 flex flex-wrap gap-2">
          {NOTICE_SEVERITY_FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                setFilter(item.value);
                setSelectedNoticeId(null);
                setSelectedNotice(null);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--knu-primary) ${
                filter === item.value
                  ? 'bg-(--knu-primary) text-white'
                  : 'bg-white text-(--knu-text-secondary) shadow-sm ring-1 ring-(--knu-border)'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {status === 'error' && (
          <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
            {error}
          </div>
        )}

        {status === 'loading' && (
          <div
            className="mt-6 grid gap-4 lg:grid-cols-[23rem_minmax(0,1fr)]"
            aria-label="공지사항 로딩 중"
          >
            <div className="h-72 animate-pulse rounded-3xl bg-white" />
            <div className="h-72 animate-pulse rounded-3xl bg-white" />
          </div>
        )}

        {status === 'success' && (
          <div className="mt-6 grid gap-4 lg:grid-cols-[23rem_minmax(0,1fr)]">
            <NoticeList
              notices={notices}
              selectedNoticeId={selectedNoticeId}
              onSelectNotice={setSelectedNoticeId}
            />
            {detailStatus === 'loading' ? (
              <article
                className="rounded-3xl border border-(--knu-border) bg-white p-6 shadow-sm"
                aria-label="공지 상세 로딩 중"
              >
                <div className="h-8 animate-pulse rounded-xl bg-(--knu-background-alt)" />
                <div className="mt-4 h-48 animate-pulse rounded-2xl bg-(--knu-background-alt)" />
              </article>
            ) : detailStatus === 'error' ? (
              <article className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm font-bold text-amber-800 shadow-sm">
                공지 상세를 불러오지 못했어요. 목록에서 다시 선택해주세요.
              </article>
            ) : (
              <NoticeArticle notice={selectedNoticeForDisplay} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

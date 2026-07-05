import type { Route } from 'next';
import Link from 'next/link';
import { AlertTriangle, Megaphone, Siren, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { HomeGlobalNoticePreview } from '../../model/operations/homeOperationsViewModel';

const NOTICE_SURFACE_STYLE: Record<
  HomeGlobalNoticePreview['severity'],
  { icon: LucideIcon; badge: string; card: string; label: string }
> = {
  INFO: {
    icon: Megaphone,
    badge: 'bg-blue-100 text-blue-700',
    card: 'border-blue-100 bg-gradient-to-br from-blue-50 via-white to-sky-50 hover:border-blue-200',
    label: '공지',
  },
  WARNING: {
    icon: AlertTriangle,
    badge: 'bg-amber-100 text-amber-800',
    card: 'border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 hover:border-amber-300',
    label: '확인 필요',
  },
  CRITICAL: {
    icon: Siren,
    badge: 'bg-red-100 text-red-700',
    card: 'border-red-200 bg-gradient-to-br from-red-50 via-white to-rose-50 hover:border-red-300',
    label: '중요',
  },
  MAINTENANCE: {
    icon: Wrench,
    badge: 'bg-slate-200 text-slate-700',
    card: 'border-slate-200 bg-gradient-to-br from-slate-50 via-white to-zinc-50 hover:border-slate-300',
    label: '점검',
  },
};

export function HomeNoticeSurface({
  notices,
  status,
}: {
  notices: HomeGlobalNoticePreview[];
  status: 'idle' | 'loading' | 'success' | 'error';
}) {
  if (status !== 'success') return null;

  const primaryNotice = notices[0];
  if (!primaryNotice) return null;

  const style = NOTICE_SURFACE_STYLE[primaryNotice.severity];
  const Icon = style.icon;

  return (
    <section aria-label="공지사항" className="overflow-hidden rounded-3xl">
      <Link
        href={`/notices/${encodeURIComponent(primaryNotice.id)}` as Route}
        className={`group block w-full rounded-3xl border p-4 text-left shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--knu-primary) md:p-5 ${style.card}`}
      >
        <span className="flex items-start gap-3 md:items-center md:gap-4">
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-2xl md:size-11 ${style.badge}`}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${style.badge}`}
              >
                {style.label}
              </span>
              <span className="text-[11px] font-bold text-(--knu-text-tertiary)">공지사항</span>
            </span>
            <span className="mt-2 block text-sm font-extrabold leading-snug text-(--knu-text-primary) md:text-base">
              {primaryNotice.title}
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-(--knu-text-secondary) md:text-sm">
              {primaryNotice.summary}
            </span>
          </span>
          <span className="hidden shrink-0 rounded-full bg-white/80 px-3 py-1.5 text-xs font-extrabold text-(--knu-primary) shadow-sm transition-colors group-hover:bg-white md:inline-flex">
            공지 보기
          </span>
        </span>
      </Link>
    </section>
  );
}

import { AlertTriangle, Megaphone, Siren, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { HomeGlobalNoticePreview } from '../../model/operations/homeOperationsViewModel';
import { OperationsPanelErrorState } from './OperationsPanelErrorState';

const NOTICE_SEVERITY_STYLE: Record<
  HomeGlobalNoticePreview['severity'],
  { icon: LucideIcon; badge: string; card: string; label: string }
> = {
  INFO: {
    icon: Megaphone,
    badge: 'bg-blue-100 text-blue-700',
    card: 'border-blue-100 bg-blue-50/70 hover:bg-blue-50',
    label: '안내',
  },
  WARNING: {
    icon: AlertTriangle,
    badge: 'bg-amber-100 text-amber-800',
    card: 'border-amber-200 bg-amber-50/80 hover:bg-amber-50',
    label: '확인 필요',
  },
  CRITICAL: {
    icon: Siren,
    badge: 'bg-red-100 text-red-700',
    card: 'border-red-200 bg-red-50/80 hover:bg-red-50',
    label: '중요',
  },
  MAINTENANCE: {
    icon: Wrench,
    badge: 'bg-slate-200 text-slate-700',
    card: 'border-slate-200 bg-slate-50/90 hover:bg-slate-50',
    label: '점검',
  },
};

export function HomeNoticeBanner({
  notices,
  status,
  error,
  onOpenNotice,
  onRetry,
}: {
  notices: HomeGlobalNoticePreview[];
  status: 'idle' | 'loading' | 'success' | 'error';
  error?: string;
  onOpenNotice: (noticeId: string) => void;
  onRetry: () => void;
}) {
  if (status === 'error') {
    return (
      <OperationsPanelErrorState
        message={error ?? '공지사항을 불러오지 못했어요.'}
        onRetry={onRetry}
      />
    );
  }

  const primaryNotice = notices[0];
  if (!primaryNotice) {
    return (
      <div className="rounded-2xl border border-(--knu-border) bg-(--knu-background-alt) p-3">
        <p className="text-xs font-bold text-(--knu-text-primary)">새 운영 공지가 없어요.</p>
        <p className="mt-1 text-[11px] leading-relaxed text-(--knu-text-tertiary)">
          시즌 일정이나 점검 안내가 생기면 이곳에 표시돼요.
        </p>
      </div>
    );
  }

  const style = NOTICE_SEVERITY_STYLE[primaryNotice.severity];
  const Icon = style.icon;

  return (
    <button
      type="button"
      onClick={() => onOpenNotice(primaryNotice.id)}
      className={`w-full rounded-2xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--knu-primary) ${style.card}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-full ${style.badge}`}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${style.badge}`}>
              {style.label}
            </span>
            <span className="text-[11px] font-semibold text-(--knu-text-tertiary)">공지사항</span>
          </span>
          <span className="mt-1 block text-sm font-extrabold text-(--knu-text-primary)">
            {primaryNotice.title}
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-(--knu-text-secondary)">
            {primaryNotice.summary}
          </span>
        </span>
      </div>
    </button>
  );
}

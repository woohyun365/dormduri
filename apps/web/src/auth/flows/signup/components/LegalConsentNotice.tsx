import { Info, RefreshCw } from 'lucide-react';

type LegalConsentNoticeStatus = 'fallback' | 'stale';

interface LegalConsentNoticeProps {
  status: LegalConsentNoticeStatus;
  isUsingFallback?: boolean;
}

const NOTICE_PRESENTATION = {
  fallback: {
    icon: Info,
    title: '저장된 동의 내용을 보여드려요',
    description: '가입할 때 최신 내용인지 다시 확인해요.',
    containerClassName: 'border-sky-200 bg-sky-50 text-sky-950',
    iconClassName: 'text-sky-600',
  },
  stale: {
    icon: RefreshCw,
    title: '동의 내용이 변경됐어요',
    description: '최신 내용을 확인하고 다시 동의해 주세요.',
    containerClassName: 'border-amber-200 bg-amber-50 text-amber-950',
    iconClassName: 'text-amber-600',
  },
} as const;

export function LegalConsentNotice({ status, isUsingFallback = false }: LegalConsentNoticeProps) {
  const presentation = NOTICE_PRESENTATION[status];
  const Icon = presentation.icon;
  const isStaleFallback = status === 'stale' && isUsingFallback;

  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-xl border p-3 ${presentation.containerClassName}`}
    >
      <Icon className={`mt-0.5 size-4 shrink-0 ${presentation.iconClassName}`} aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          {isStaleFallback ? '동의 내용을 다시 확인해 주세요' : presentation.title}
        </p>
        <p className="mt-0.5 keep-all text-xs leading-5">
          {isStaleFallback
            ? '저장된 내용을 보여드리며, 가입할 때 최신 여부를 확인해요.'
            : presentation.description}
        </p>
      </div>
    </div>
  );
}

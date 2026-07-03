import { HelpCircle, LifeBuoy } from 'lucide-react';
import type { SupportFaqItem } from '@repo/shared/support';
import { OperationsPanelErrorState } from './OperationsPanelErrorState';

export function SupportCenterEntry({
  faqs,
  status,
  error,
  onRetry,
}: {
  faqs: SupportFaqItem[];
  status: 'idle' | 'loading' | 'success' | 'error';
  error?: string;
  onRetry: () => void;
}) {
  if (status === 'error') {
    return (
      <OperationsPanelErrorState
        message={error ?? '문의 안내를 불러오지 못했어요.'}
        onRetry={onRetry}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/45 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <LifeBuoy className="size-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-extrabold text-(--knu-text-primary)">문의하기</p>
          <p className="text-[11px] text-(--knu-text-tertiary)">
            답변과 추가 확인은 문의 내역에서 이어져요.
          </p>
        </div>
      </div>

      {faqs.length > 0 ? (
        <div className="space-y-1.5">
          {faqs.map((faq) => (
            <div key={faq.id} className="flex items-start gap-2 rounded-xl bg-white/75 px-3 py-2">
              <HelpCircle
                className="mt-0.5 size-3.5 shrink-0 text-emerald-700"
                aria-hidden="true"
              />
              <p className="text-xs font-bold leading-relaxed text-(--knu-text-secondary)">
                {faq.question}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl bg-white/70 px-3 py-2 text-xs font-bold text-(--knu-text-secondary)">
          자주 묻는 질문은 준비 중이에요.
        </p>
      )}
    </div>
  );
}

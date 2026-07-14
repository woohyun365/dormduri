import { RefreshCw } from 'lucide-react';
import type { RoommateActionFeedback, RoommateActionReceipt } from '../../hooks/useRoommateActions';

export function RoommateActionFeedbackBanner({
  receipt,
  error,
  onDismiss,
}: {
  readonly receipt: RoommateActionReceipt | null;
  readonly error: RoommateActionFeedback | null;
  readonly onDismiss: () => void;
}) {
  const visibleError = error?.actionKind === 'matchRequest' ? null : error;
  const visibleReceipt = getInlineReceipt(receipt);
  const feedback = visibleError ?? visibleReceipt;
  if (!feedback) return null;

  const isError = visibleError !== null;
  return (
    <section
      role={isError ? 'alert' : 'status'}
      className={`rounded-3xl border bg-white p-4 shadow-sm ${
        isError ? 'border-red-100' : 'border-emerald-100'
      }`}
    >
      <p className={`text-sm font-bold ${isError ? 'text-red-700' : 'text-emerald-700'}`}>
        {feedback.title}
      </p>
      <p className="mt-2 text-xs leading-5 text-(--knu-text-secondary)">{feedback.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-3 rounded-xl border border-(--knu-border) px-3 py-2 text-xs font-semibold text-(--knu-text-secondary)"
      >
        알림 닫기
      </button>
    </section>
  );
}

export function getDialogReceipt(
  receipt: RoommateActionReceipt | null,
): RoommateActionReceipt | null {
  if (
    receipt?.actionKind === 'matchRequest' ||
    receipt?.actionKind === 'block' ||
    receipt?.actionKind === 'report'
  ) {
    return receipt;
  }
  return null;
}

export function RoommateBookmarkErrorBanner({
  message,
  onRetry,
  onDismiss,
}: {
  readonly message: string | null;
  readonly onRetry: () => void;
  readonly onDismiss: () => void;
}) {
  if (!message) return null;

  return (
    <section
      role="alert"
      className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-bold">관심 목록을 변경하지 못했어요.</p>
          <p className="mt-1 text-xs leading-5 text-amber-700">
            {message} 최신 목록으로 다시 확인해 주세요.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-700"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            목록 새로고침
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-2xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-700"
          >
            닫기
          </button>
        </div>
      </div>
    </section>
  );
}

function getInlineReceipt(receipt: RoommateActionReceipt | null): RoommateActionReceipt | null {
  if (
    receipt?.actionKind === 'matchRequest' ||
    receipt?.actionKind === 'block' ||
    receipt?.actionKind === 'report'
  ) {
    return null;
  }
  return receipt;
}

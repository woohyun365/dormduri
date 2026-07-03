import { RefreshCw } from 'lucide-react';

export function OperationsPanelErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-amber-800">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-amber-800 shadow-sm transition-colors hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          <RefreshCw className="size-3" aria-hidden="true" />
          다시 시도
        </button>
      </div>
    </div>
  );
}

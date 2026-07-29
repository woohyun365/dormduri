import { AlertCircle } from 'lucide-react';

interface SessionUnavailableNoticeProps {
  onRetryAction: () => void;
  message?: string;
}

export function SessionUnavailableNotice({
  onRetryAction,
  message = '로그인 상태를 확인하지 못했어요. 현재 화면은 계속 이용할 수 있어요.',
}: SessionUnavailableNoticeProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700"
    >
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-6">{message}</p>
        <button
          type="button"
          onClick={onRetryAction}
          className="mt-2 rounded-md px-1 py-0.5 text-sm font-semibold text-slate-700 underline-offset-4 hover:bg-slate-100 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
        >
          다시 확인
        </button>
      </div>
    </div>
  );
}

import { LoginFeedbackStrip } from './LoginFeedbackStrip';

interface LoginSessionUnavailableStatusProps {
  onRetryAction: () => void;
}

export function LoginSessionUnavailableStatus({
  onRetryAction,
}: LoginSessionUnavailableStatusProps) {
  return (
    <LoginFeedbackStrip
      variant="connectivity"
      role="status"
      title="로그인 상태 확인이 잠시 늦어져요"
    >
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="text-xs text-rose-700">로그인은 계속할 수 있어요.</p>
        <button
          type="button"
          onClick={onRetryAction}
          className="shrink-0 rounded-md px-1.5 py-1 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 hover:text-rose-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
        >
          다시 확인
        </button>
      </div>
    </LoginFeedbackStrip>
  );
}

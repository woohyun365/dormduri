import { RefreshCw } from 'lucide-react';

const GENERIC_ERROR_TITLE = '서버 오류로 프로필 접근에 실패했어요.';
const GENERIC_ERROR_MESSAGE = '목록을 새로고침한 뒤 다시 열람해 주세요.';

export function DetailError({
  retryable,
  onRetry,
  onRefreshList,
}: {
  readonly retryable: boolean;
  readonly onRetry: () => void;
  readonly onRefreshList: () => void;
}) {
  return (
    <section role="alert" className="rounded-3xl border border-red-100 bg-white p-5 text-center">
      <p className="text-base font-bold text-red-700">{GENERIC_ERROR_TITLE}</p>
      <p className="mt-2 text-sm leading-6 text-(--knu-text-secondary)">{GENERIC_ERROR_MESSAGE}</p>
      <div className="mt-5 grid gap-2">
        {retryable ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-(--knu-primary) px-4 py-3 text-sm font-semibold text-white"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            다시 시도
          </button>
        ) : null}
        <button
          type="button"
          onClick={onRefreshList}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-(--knu-border) bg-white px-4 py-3 text-sm font-semibold text-(--knu-primary)"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          목록 새로고침
        </button>
      </div>
    </section>
  );
}

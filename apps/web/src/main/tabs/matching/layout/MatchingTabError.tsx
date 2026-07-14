export function MatchingTabError({
  message,
  onRetry,
}: {
  readonly message: string;
  readonly onRetry?: () => Promise<void>;
}) {
  return (
    <section
      role={onRetry ? 'alert' : 'status'}
      className="rounded-3xl border border-(--knu-border) bg-white p-6 shadow-sm"
    >
      <h2 className="text-lg font-bold text-(--knu-text-primary)">
        {onRetry ? '매칭 정보를 불러오지 못했어요' : '현재 매칭을 이용할 수 없어요'}
      </h2>
      <p className="mt-2 text-sm leading-6 text-(--knu-text-secondary)">{message}</p>
      {onRetry && (
        <button
          type="button"
          className="mt-5 min-h-11 rounded-2xl bg-(--knu-primary) px-4 py-2 text-sm font-semibold text-white"
          onClick={() => void onRetry()}
        >
          다시 시도
        </button>
      )}
    </section>
  );
}

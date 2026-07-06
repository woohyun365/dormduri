interface HomeDashboardErrorStateProps {
  message: string;
  refreshing: boolean;
  onRetry: () => Promise<void>;
}

export function HomeDashboardErrorState({
  message,
  refreshing,
  onRetry,
}: HomeDashboardErrorStateProps) {
  return (
    <section className="min-h-[50vh] px-5 py-12">
      <div
        role="alert"
        className="max-w-md mx-auto rounded-2xl border border-red-100 bg-white p-5 text-center shadow-sm"
      >
        <h2 className="text-base font-bold text-(--knu-text-primary)">
          홈 정보를 불러오지 못했어요
        </h2>
        <p className="mt-2 text-sm text-(--knu-text-secondary)">{message}</p>
        <button
          type="button"
          onClick={() => {
            void onRetry();
          }}
          disabled={refreshing}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-(--knu-primary) px-4 text-sm font-semibold text-white transition-colors hover:bg-(--knu-primary-hover) disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? '다시 불러오는 중...' : '다시 시도'}
        </button>
      </div>
    </section>
  );
}

import type { MatchHistorySummary } from '../../model/matching-view-model';

export function OffSeasonState({
  historySummary,
}: {
  readonly historySummary: MatchHistorySummary;
}) {
  return (
    <section className="rounded-3xl border border-(--knu-border) bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-(--knu-primary)">비시즌</p>
      <h2 className="mt-1 text-xl font-bold text-(--knu-text-primary)">
        현재 매칭 요청은 쉬고 있어요
      </h2>
      <p className="mt-3 text-sm leading-6 text-(--knu-text-secondary)">
        다음 시즌이 열리면 다시 참여할 수 있어요. 과거 결과는 이력 화면에서 계속 확인할 수 있어요.
      </p>
      <p className="mt-4 text-sm text-(--knu-text-secondary)">
        확인 가능한 지난 시즌 {historySummary.seasons}개
      </p>
    </section>
  );
}

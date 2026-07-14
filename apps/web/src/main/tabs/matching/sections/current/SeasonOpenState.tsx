import type { MatchHistorySummary } from '../../model/matching-view-model';

export function SeasonOpenState({
  historySummary,
}: {
  readonly historySummary: MatchHistorySummary;
}) {
  return (
    <section className="rounded-3xl border border-(--knu-border) bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-(--knu-primary)">시즌 준비</p>
      <h2 className="mt-1 text-xl font-bold text-(--knu-text-primary)">
        매칭 프로필을 준비해주세요
      </h2>
      <p className="mt-3 text-sm leading-6 text-(--knu-text-secondary)">
        시즌 참여 등록과 프로필 준비는 가능하지만 룸메이트 요청은 아직 열리지 않았어요.
      </p>
      {historySummary.seasons > 0 && (
        <p className="mt-4 text-sm text-(--knu-text-secondary)">
          지난 시즌 결과 {historySummary.seasons}개를 확인할 수 있어요.
        </p>
      )}
    </section>
  );
}

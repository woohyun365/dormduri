import type { MatchOverviewResponse } from '@repo/shared/match/contract';

export function SeasonPostMatchState({
  activeMatch,
}: {
  readonly activeMatch: MatchOverviewResponse['activeMatch'];
}) {
  return (
    <section className="rounded-3xl border border-(--knu-border) bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-(--knu-primary)">시즌 결과</p>
      <h2 className="mt-1 text-xl font-bold text-(--knu-text-primary)">
        {activeMatch ? '이번 시즌 룸메이트가 정해졌어요' : '이번 시즌 매칭 결과가 없어요'}
      </h2>
      <p className="mt-3 text-sm leading-6 text-(--knu-text-secondary)">
        {activeMatch
          ? `${activeMatch.counterpartNickname ?? '매칭된 사용자'}님과의 확정 결과를 확인할 수 있어요.`
          : '시즌은 종료됐으며 새로운 요청이나 매칭 해제 작업은 할 수 없어요.'}
      </p>
      <p className="mt-4 text-sm font-medium text-(--knu-text-secondary)">
        이 화면은 결과 확인 전용이에요.
      </p>
    </section>
  );
}

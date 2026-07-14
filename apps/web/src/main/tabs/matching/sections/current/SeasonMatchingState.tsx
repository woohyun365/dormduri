import type { CurrentMatchingView } from '../../model/matching-view-model';

export function SeasonMatchingState({ current }: { readonly current: CurrentMatchingView }) {
  return (
    <section className="rounded-3xl border border-(--knu-border) bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-(--knu-primary)">매칭 진행 중</p>
      <h2 className="mt-1 text-xl font-bold text-(--knu-text-primary)">현재 요청을 확인해보세요</h2>
      <p className="mt-3 text-sm leading-6 text-(--knu-text-secondary)">
        보낸 요청 {current.sentRequests.length}건, 받은 요청 {current.receivedPendingCount}건을
        확인할 수 있어요.
      </p>
      <div
        data-testid="matching-current-sections-slot"
        className="mt-5 rounded-2xl bg-(--knu-background-alt) p-4 text-sm leading-6 text-(--knu-text-secondary)"
      >
        요청과 활성 매칭의 상세 작업은 서버 capability를 기준으로 이 영역에 표시돼요.
      </div>
    </section>
  );
}

import type { MatchingViewState } from '../model/matching-view-model';
import { MatchingTabLayout } from '../layout/MatchingTabLayout';

export function SeasonStateRenderer({
  state,
}: {
  readonly state: Exclude<MatchingViewState, { kind: 'loading' | 'error' | 'unavailable' }>;
}) {
  const message =
    state.kind === 'season-matching'
      ? `보낸 요청 ${state.current.sentRequests.length}건, 받은 요청 ${state.current.receivedPendingCount}건을 확인할 수 있어요.`
      : state.kind === 'season-post-match'
        ? state.activeMatch
          ? '이번 시즌 매칭 결과를 확인할 수 있어요.'
          : '이번 시즌 매칭 결과가 없어요.'
        : '현재 매칭 요청은 열려 있지 않아요.';
  return (
    <MatchingTabLayout
      rail={
        <p className="text-sm text-gray-600">매칭 상태는 서버의 최신 정보를 기준으로 표시돼요.</p>
      }
    >
      <section aria-labelledby="matching-runtime-heading">
        <h1 id="matching-runtime-heading" tabIndex={-1} className="text-xl font-bold">
          매칭 현황
        </h1>
        <p className="mt-3">{message}</p>
      </section>
    </MatchingTabLayout>
  );
}

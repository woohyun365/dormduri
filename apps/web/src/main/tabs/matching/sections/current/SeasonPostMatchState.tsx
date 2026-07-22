import type { MatchOverviewResponse } from '@repo/shared/match/contract';
import { ActiveMatchSection } from '../active/ActiveMatchSection';
import { PairMatchingFlowTipCard } from '../../components/pair/PairMatchingFlowTipCard';
import type { CurrentMatchActivityItemView } from '../../model/matching-current-activity-view';
import { CurrentMatchActivitySection } from './CurrentMatchActivitySection';

export function SeasonPostMatchState({
  activeMatch,
  roomSelectionDate,
  seasonEndDate,
  activity,
  onNavigateChat,
}: {
  readonly activeMatch: MatchOverviewResponse['activeMatch'];
  readonly roomSelectionDate?: string | null;
  readonly seasonEndDate?: string | null;
  readonly activity: readonly CurrentMatchActivityItemView[];
  readonly onNavigateChat?: () => void;
}) {
  return (
    <section className="min-w-0">
      <h2 className="sr-only">
        {activeMatch ? '이번 시즌 매칭 결과를 확인해보세요' : '이번 시즌 결과를 확인해보세요'}
      </h2>
      <div
        data-testid="matching-post-match-layout"
        className="grid items-start gap-5 md:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.8fr)]"
      >
        <div className="order-last min-w-0 space-y-5 md:order-first">
          {activeMatch ? (
            <ActiveMatchSection
              activeMatch={activeMatch}
              readOnly
              roomSelectionDate={roomSelectionDate}
              seasonEndDate={seasonEndDate}
              onNavigateChat={onNavigateChat}
            />
          ) : null}
          <CurrentMatchActivitySection items={activity} />
        </div>
        <aside
          className="order-first min-w-0 md:sticky md:top-[calc(var(--matching-sticky-stack-height,224px)_+_1.25rem)] md:order-last"
          aria-label="2인실 매칭 안내"
        >
          <PairMatchingFlowTipCard phase="post-match" matched={Boolean(activeMatch)} />
        </aside>
      </div>
    </section>
  );
}

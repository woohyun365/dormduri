import type { MatchOverviewResponse } from '@repo/shared/match/contract';
import type { CurrentMatchActivityItemView } from '../../model/matching-current-activity-view';
import type { MatchHistorySummary } from '../../model/matching-view-model';
import type { MatchingNavigationIntent } from '../../model/matching-navigation-intent';
import { CurrentMatchActivitySection } from './CurrentMatchActivitySection';
import { MatchingCurrentPolicyGate } from './MatchingCurrentPolicyGate';

export function DeregisteredMatchingState({
  seasonState,
  historySummary,
  activity,
  onNavigate,
}: {
  readonly seasonState: MatchOverviewResponse['season']['state'];
  readonly historySummary: MatchHistorySummary;
  readonly activity: readonly CurrentMatchActivityItemView[];
  readonly onNavigate?: (intent: MatchingNavigationIntent) => void;
}) {
  return (
    <section className="min-w-0 space-y-5">
      <MatchingCurrentPolicyGate
        gate={{
          kind: 'deregistered',
          seasonState,
          hasHistory: historySummary.seasons > 0,
        }}
        onNavigate={onNavigate}
      />
      {seasonState === 'SEASON_OPEN' ? null : <CurrentMatchActivitySection items={activity} />}
    </section>
  );
}

import type { MatchHistorySummary } from '../../model/matching-view-model';
import type { MatchingNavigationIntent } from '../../model/matching-navigation-intent';
import { MatchingCurrentPolicyGate } from './MatchingCurrentPolicyGate';

export function OffSeasonState({
  historySummary,
  onNavigate,
}: {
  readonly historySummary: MatchHistorySummary;
  readonly onNavigate?: (intent: MatchingNavigationIntent) => void;
}) {
  return (
    <MatchingCurrentPolicyGate
      gate={{ kind: 'off-season', hasHistory: historySummary.seasons > 0 }}
      onNavigate={onNavigate}
    />
  );
}

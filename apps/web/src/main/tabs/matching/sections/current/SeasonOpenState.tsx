import type { MatchHistorySummary } from '../../model/matching-view-model';
import type { MatchingNavigationIntent } from '../../model/matching-navigation-intent';
import { MatchingCurrentPolicyGate } from './MatchingCurrentPolicyGate';

export function SeasonOpenState({
  historySummary: _historySummary,
  onNavigate,
}: {
  readonly historySummary: MatchHistorySummary;
  readonly onNavigate?: (intent: MatchingNavigationIntent) => void;
}) {
  return <MatchingCurrentPolicyGate gate={{ kind: 'season-open' }} onNavigate={onNavigate} />;
}

import type { MatchingViewState } from '../model/matching-view-model';
import { OffSeasonState } from './current/OffSeasonState';
import { SeasonOpenState } from './current/SeasonOpenState';
import { SeasonMatchingState } from './current/SeasonMatchingState';
import { SeasonPostMatchState } from './current/SeasonPostMatchState';

export function SeasonStateRenderer({
  state,
}: {
  readonly state: Exclude<MatchingViewState, { kind: 'loading' | 'error' | 'unavailable' }>;
}) {
  switch (state.kind) {
    case 'off-season':
      return <OffSeasonState historySummary={state.historySummary} />;
    case 'season-open':
      return <SeasonOpenState historySummary={state.historySummary} />;
    case 'season-matching':
      return <SeasonMatchingState current={state.current} />;
    case 'season-post-match':
      return <SeasonPostMatchState activeMatch={state.activeMatch} />;
  }
}

import type { MatchingSection } from '../components/MatchingSectionTabs';
import type { MatchingViewState } from './matching-view-model';

/**
 * The tab selection is presentation state, but its initial priority follows
 * the season: closed/preparation periods primarily serve as a history entry.
 * A user selection always takes precedence after the first render.
 */
export function getMatchingDefaultSection(state: MatchingViewState): MatchingSection {
  switch (state.kind) {
    case 'off-season':
    case 'season-open':
      return 'past';
    case 'deregistered':
      return state.seasonState === 'SEASON_OPEN' || state.seasonState === 'OFF_SEASON'
        ? 'past'
        : 'current';
    default:
      return 'current';
  }
}

import type { MatchingViewState } from '../model/matching-view-model';
import { OffSeasonState } from './current/OffSeasonState';
import { SeasonOpenState } from './current/SeasonOpenState';
import { SeasonMatchingState } from './current/SeasonMatchingState';
import { SeasonPostMatchState } from './current/SeasonPostMatchState';
import type { MatchingRequestCommands } from './requests/PairRequestSection';
import type { MatchingRequestTab } from '../components/MatchingSegmentTabs';

export function SeasonStateRenderer({
  state,
  requestCommands,
  onNavigateChat,
  initialRequestTab,
}: {
  readonly state: Exclude<MatchingViewState, { kind: 'loading' | 'error' | 'unavailable' }>;
  readonly requestCommands: MatchingRequestCommands;
  readonly onNavigateChat?: () => void;
  readonly initialRequestTab?: MatchingRequestTab;
}) {
  switch (state.kind) {
    case 'off-season':
      return <OffSeasonState historySummary={state.historySummary} />;
    case 'season-open':
      return <SeasonOpenState historySummary={state.historySummary} />;
    case 'season-matching':
      return (
        <SeasonMatchingState
          current={state.current}
          requestCommands={requestCommands}
          onNavigateChat={onNavigateChat}
          initialRequestTab={initialRequestTab}
        />
      );
    case 'season-post-match':
      return <SeasonPostMatchState activeMatch={state.activeMatch} />;
  }
}

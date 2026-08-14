import type { MatchingViewState } from '../model/matching-view-model';
import { OffSeasonState } from './current/OffSeasonState';
import { SeasonOpenState } from './current/SeasonOpenState';
import { SeasonMatchingState } from './current/SeasonMatchingState';
import { SeasonPostMatchState } from './current/SeasonPostMatchState';
import type { MatchingRequestCommands } from './requests/PairRequestSection';
import type { MatchingRequestTab } from '../components/MatchingSegmentTabs';
import type { MatchingActiveCommands } from './active/ActiveMatchSection';
import type { MatchingNavigationIntent } from '../model/matching-navigation-intent';

export function SeasonStateRenderer({
  state,
  requestCommands,
  activeCommands,
  activeActionError,
  unmatchCompletion,
  onDismissActiveActionError,
  onDismissUnmatchCompletion,
  onNavigateChat,
  onNavigationIntent,
  onRefreshOverview,
  initialRequestTab,
}: {
  readonly state: Exclude<
    MatchingViewState,
    { kind: 'loading' | 'error' | 'unavailable' | 'deregistered' }
  >;
  readonly requestCommands: MatchingRequestCommands;
  readonly activeCommands?: MatchingActiveCommands;
  readonly activeActionError?: string | null;
  readonly unmatchCompletion?: string | null;
  readonly onDismissActiveActionError?: () => void;
  readonly onDismissUnmatchCompletion?: () => void;
  readonly onNavigateChat?: () => void;
  readonly onNavigationIntent?: (intent: MatchingNavigationIntent) => void;
  readonly onRefreshOverview?: () => Promise<void>;
  readonly initialRequestTab?: MatchingRequestTab;
}) {
  switch (state.kind) {
    case 'off-season':
      return (
        <OffSeasonState historySummary={state.historySummary} onNavigate={onNavigationIntent} />
      );
    case 'season-open':
      return (
        <SeasonOpenState historySummary={state.historySummary} onNavigate={onNavigationIntent} />
      );
    case 'season-matching':
      const resolvedActiveCommands =
        activeCommands ??
        ({
          requestUnmatch: async () => 'error' as const,
          cancelUnmatchRequest: async () => 'error' as const,
          isPending: () => false,
        } satisfies MatchingActiveCommands);
      return (
        <SeasonMatchingState
          current={state.current}
          requestCommands={requestCommands}
          activeCommands={resolvedActiveCommands}
          activeActionError={activeActionError}
          unmatchCompletion={unmatchCompletion}
          onDismissActiveActionError={onDismissActiveActionError}
          onDismissUnmatchCompletion={onDismissUnmatchCompletion}
          onNavigateChat={onNavigateChat}
          onRefreshOverview={onRefreshOverview}
          initialRequestTab={initialRequestTab}
        />
      );
    case 'season-post-match':
      return (
        <SeasonPostMatchState
          activeMatch={state.activeMatch}
          roomSelectionDate={state.roomSelectionDate}
          seasonEndDate={state.seasonEndDate}
          activity={state.activity}
          onNavigateChat={onNavigateChat}
        />
      );
  }
}

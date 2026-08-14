'use client';

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { MatchingViewState } from './model/matching-view-model';
import type {
  MatchingSeasonShell,
  MatchingShellConsistency,
} from './model/matching-shell-consistency';
import { MatchingTabError } from './layout/MatchingTabError';
import { MatchingTabHeader } from './layout/MatchingTabHeader';
import { MatchingTabLayout } from './layout/MatchingTabLayout';
import { MatchingTabSkeleton } from './layout/MatchingTabSkeleton';
import { toMatchingApiErrorMessage } from './api/matching.api';
import { useMatchingOverview } from './hooks/useMatchingOverview';
import { useMatchingActions, type RequestActionCompletion } from './hooks/useMatchingActions';
import { useMatchingHistory } from './hooks/useMatchingHistory';
import { useConversationStats } from '../chat/hooks/useConversationStats';
import { toMatchingShellPresentation } from './model/matching-shell-presentation';
import { resolveMatchingShellConsistency } from './model/matching-shell-consistency';
import { toMatchingViewState } from './model/matching-view-model';
import { SeasonStateRenderer } from './sections/SeasonStateRenderer';
import { MatchingCurrentPolicyGate } from './sections/current/MatchingCurrentPolicyGate';
import { MatchingUnavailableState } from './sections/system/MatchingUnavailableState';
import type { MatchingRequestCommands } from './sections/requests/PairRequestSection';
import type { MatchingActiveCommands } from './sections/active/ActiveMatchSection';
import type { MatchingRequestTab } from './components/MatchingSegmentTabs';
import { MatchingSectionTabs, type MatchingSection } from './components/MatchingSectionTabs';
import { MatchHistorySection } from './sections/history/MatchHistorySection';
import type { MatchingNavigationIntent } from './model/matching-navigation-intent';
import { getMatchingDefaultSection } from './model/matching-default-section';
import type { MatchingViewerHeader } from './model/matching-viewer-header';
import { MatchRequestResultDialog } from './overlays/MatchRequestResultDialog';
import { DeregisteredMatchingState } from './sections/current/DeregisteredMatchingState';

export interface MatchingTabProps {
  readonly viewerId: string;
  readonly viewerHeader?: MatchingViewerHeader;
  readonly seasonShell: MatchingSeasonShell;
  readonly onBadgeCountChange?: (count: number) => void;
  readonly onNavigateChat?: () => void;
  readonly onNavigationIntent?: (intent: MatchingNavigationIntent) => void;
  readonly initialRequestTab?: MatchingRequestTab;
  readonly initialSection?: MatchingSection;
}

export default function MatchingTab({
  viewerId,
  viewerHeader,
  seasonShell,
  onBadgeCountChange,
  onNavigateChat,
  onNavigationIntent,
  initialRequestTab,
  initialSection,
}: MatchingTabProps) {
  const identityKey = `${viewerId}:${seasonShell.id ?? 'none'}:${seasonShell.state ?? 'none'}`;
  return (
    <MatchingTabRuntime
      key={identityKey}
      identityKey={identityKey}
      viewerHeader={viewerHeader}
      seasonShell={seasonShell}
      onBadgeCountChange={onBadgeCountChange}
      onNavigateChat={onNavigateChat}
      onNavigationIntent={onNavigationIntent}
      initialRequestTab={initialRequestTab}
      initialSection={initialSection}
    />
  );
}

function MatchingTabRuntime({
  identityKey,
  viewerHeader,
  seasonShell,
  onBadgeCountChange,
  onNavigateChat,
  onNavigationIntent,
  initialRequestTab,
  initialSection,
}: {
  readonly identityKey: string;
  readonly viewerHeader?: MatchingViewerHeader;
  readonly seasonShell: MatchingSeasonShell;
  readonly onBadgeCountChange?: (count: number) => void;
  readonly onNavigateChat?: () => void;
  readonly onNavigationIntent?: (intent: MatchingNavigationIntent) => void;
  readonly initialRequestTab?: MatchingRequestTab;
  readonly initialSection?: MatchingSection;
}) {
  const overview = useMatchingOverview({ identityKey });
  const history = useMatchingHistory({ identityKey });
  const conversationStats = useConversationStats({ identityKey });
  const {
    data: historyData,
    error: historyError,
    loading: historyLoading,
    load: loadHistory,
  } = history;
  const {
    data: conversationStatsData,
    error: conversationStatsError,
    loading: conversationStatsLoading,
    load: loadConversationStats,
  } = conversationStats;
  const actions = useMatchingActions({ refetchOverview: overview.refresh });
  const view = toMatchingViewState({
    overview: overview.data,
    history: historyData,
    error: overview.error,
    loading: overview.loading,
  });
  const previousActiveId = useRef<string | null>(null);
  const initializedActiveId = useRef(false);
  const headingFocused = useRef(false);
  const [celebration, setCelebration] = useState<string | null>(null);
  const [mismatchCount, setMismatchCount] = useState(0);
  const [selectedSection, setSelectedSection] = useState<MatchingSection | null>(
    initialSection ?? null,
  );
  const section = selectedSection ?? getMatchingDefaultSection(view);

  const handleNavigationIntent = (intent: MatchingNavigationIntent) => {
    if (intent === 'history') {
      setSelectedSection('past');
      return;
    }
    onNavigationIntent?.(intent);
  };

  const consistency = useMemo<MatchingShellConsistency | null>(() => {
    if (!overview.data) return null;
    return resolveMatchingShellConsistency({
      shell: seasonShell,
      overview: overview.data.season,
      consecutiveMismatchCount: mismatchCount,
    });
  }, [mismatchCount, overview.data, seasonShell]);

  useEffect(() => {
    if (view.kind === 'loading' || headingFocused.current) return;
    document.getElementById('matching-tab-heading')?.focus({ preventScroll: true });
    headingFocused.current = true;
  }, [view.kind]);

  useEffect(() => {
    let active = true;
    if (!consistency) return;
    if (consistency.kind === 'consistent') {
      if (mismatchCount !== 0) {
        queueMicrotask(() => {
          if (active) setMismatchCount(0);
        });
      }
      return () => {
        active = false;
      };
    }
    if (consistency.kind === 'transitioning') {
      queueMicrotask(() => {
        if (!active) return;
        setMismatchCount(consistency.nextMismatchCount);
        void overview.refresh();
      });
    }
    return () => {
      active = false;
    };
  }, [consistency, mismatchCount, overview]);

  const receivedCount =
    consistency?.kind === 'consistent' && view.kind === 'season-matching'
      ? view.current.receivedPendingCount
      : 0;
  useEffect(() => onBadgeCountChange?.(receivedCount), [onBadgeCountChange, receivedCount]);

  useEffect(() => {
    if (consistency?.kind !== 'consistent') return;
    const activeId = overview.data?.activeMatch?.id ?? null;
    if (initializedActiveId.current && previousActiveId.current === null && activeId !== null) {
      const nickname = overview.data?.activeMatch?.counterpartNickname ?? '새 룸메이트';
      queueMicrotask(() => setCelebration(nickname));
    }
    initializedActiveId.current = true;
    previousActiveId.current = activeId;
  }, [consistency?.kind, overview.data?.activeMatch]);

  useEffect(() => {
    if (section !== 'past' || historyData || historyLoading || historyError) return;
    void loadHistory();
  }, [historyData, historyError, historyLoading, loadHistory, section]);

  useEffect(() => {
    if (
      section !== 'past' ||
      conversationStatsData ||
      conversationStatsLoading ||
      conversationStatsError
    )
      return;
    void loadConversationStats();
  }, [
    conversationStatsData,
    conversationStatsError,
    conversationStatsLoading,
    loadConversationStats,
    section,
  ]);

  useEffect(() => {
    const headingId =
      section === 'past' ? 'matching-history-heading' : 'matching-current-section-heading';
    queueMicrotask(() => document.getElementById(headingId)?.focus({ preventScroll: true }));
  }, [section]);

  return (
    <MatchingTabView
      state={view}
      viewerHeader={viewerHeader}
      consistency={consistency}
      celebration={celebration}
      onCloseCelebration={() => setCelebration(null)}
      onRetry={overview.refresh}
      requestCommands={actions}
      activeCommands={actions}
      requestActionError={
        actions.requestError ? toMatchingApiErrorMessage(actions.requestError.code) : null
      }
      requestActionCompletion={actions.requestCompletion}
      activeActionError={
        actions.activeError ? toMatchingApiErrorMessage(actions.activeError.code) : null
      }
      unmatchCompletion={actions.unmatchCompletion?.message ?? null}
      onDismissRequestActionError={actions.dismissRequestError}
      onDismissRequestActionCompletion={actions.dismissRequestCompletion}
      onDismissActiveActionError={actions.dismissActiveError}
      onDismissUnmatchCompletion={actions.dismissUnmatchCompletion}
      onNavigateChat={onNavigateChat}
      onNavigationIntent={handleNavigationIntent}
      initialRequestTab={initialRequestTab}
      selectedSection={section}
      onSelectSection={setSelectedSection}
      pastContent={
        <MatchHistorySection
          data={historyData}
          loading={historyLoading}
          error={historyError}
          onRetry={() => {
            void loadHistory();
            void loadConversationStats();
          }}
          conversationStats={conversationStatsData}
        />
      }
    />
  );
}

export function MatchingTabView({
  state,
  viewerHeader,
  consistency = null,
  celebration = null,
  onCloseCelebration,
  onRetry,
  requestCommands,
  activeCommands,
  requestActionError = null,
  requestActionCompletion = null,
  activeActionError = null,
  unmatchCompletion = null,
  onDismissRequestActionError,
  onDismissRequestActionCompletion,
  onDismissActiveActionError,
  onDismissUnmatchCompletion,
  onNavigateChat,
  onNavigationIntent,
  initialRequestTab,
  selectedSection = 'current',
  onSelectSection,
  pastContent,
}: {
  readonly state: MatchingViewState;
  readonly viewerHeader?: MatchingViewerHeader;
  readonly consistency?: MatchingShellConsistency | null;
  readonly celebration?: string | null;
  readonly onCloseCelebration?: () => void;
  readonly onRetry?: () => Promise<void>;
  readonly requestCommands?: MatchingRequestCommands;
  readonly activeCommands?: MatchingActiveCommands;
  readonly requestActionError?: string | null;
  readonly requestActionCompletion?: RequestActionCompletion | null;
  readonly activeActionError?: string | null;
  readonly unmatchCompletion?: string | null;
  readonly onDismissRequestActionError?: () => void;
  readonly onDismissRequestActionCompletion?: () => void;
  readonly onDismissActiveActionError?: () => void;
  readonly onDismissUnmatchCompletion?: () => void;
  readonly onNavigateChat?: () => void;
  readonly onNavigationIntent?: (intent: MatchingNavigationIntent) => void;
  readonly initialRequestTab?: MatchingRequestTab;
  readonly selectedSection?: MatchingSection;
  readonly onSelectSection?: (section: MatchingSection) => void;
  readonly pastContent?: ReactNode;
}) {
  const stickyStackRef = useRef<HTMLDivElement | null>(null);
  const [stickyStackHeight, setStickyStackHeight] = useState(224);
  useLayoutEffect(() => {
    const node = stickyStackRef.current;
    if (!node) return;
    const updateHeight = () => setStickyStackHeight(Math.ceil(node.getBoundingClientRect().height));
    updateHeight();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const presentation = toMatchingShellPresentation({ state, consistency });
  const deadlineLabel = toMatchingDeadlineLabel(state);
  const handleNavigationIntent = (intent: MatchingNavigationIntent) => {
    if (intent === 'history') {
      handleSectionSelect('past');
      return;
    }
    onNavigationIntent?.(intent);
  };
  const handleSectionSelect = (section: MatchingSection) => {
    if (section === selectedSection) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    onSelectSection?.(section);
  };

  if (state.kind === 'loading' && selectedSection === 'current') {
    return <MatchingTabSkeleton presentation={presentation} viewer={viewerHeader} />;
  }

  let currentContent: ReactNode;
  if (state.kind === 'loading') {
    currentContent = <MatchingTabSkeleton />;
  } else if (state.kind === 'error') {
    currentContent = (
      <MatchingTabError message={toMatchingApiErrorMessage(state.error.code)} onRetry={onRetry} />
    );
  } else if (state.kind === 'unavailable') {
    currentContent = (
      <MatchingCurrentPolicyGate
        gate={{
          kind: 'capability',
          reason: state.reason,
          seasonState: state.seasonState,
          hasHistory: state.historySummary.seasons > 0,
        }}
        onNavigate={handleNavigationIntent}
      />
    );
  } else if (state.kind === 'deregistered') {
    currentContent = (
      <DeregisteredMatchingState
        seasonState={state.seasonState}
        historySummary={state.historySummary}
        activity={state.activity}
        onNavigate={handleNavigationIntent}
      />
    );
  } else if (consistency?.kind === 'transitioning') {
    currentContent = (
      <MatchingUnavailableState message="시즌 전환을 확인하고 있어요. 잠시만 기다려주세요." />
    );
  } else if (consistency?.kind === 'mismatch') {
    currentContent = (
      <MatchingTabError
        message="홈과 매칭의 시즌 정보가 달라 최신 상태를 다시 확인해야 해요."
        onRetry={onRetry}
      />
    );
  } else {
    const commands: MatchingRequestCommands =
      requestCommands ??
      ({
        accept: async () => 'error' as const,
        reject: async () => 'error' as const,
        cancel: async () => 'error' as const,
        isPending: () => false,
      } satisfies MatchingRequestCommands);
    const resolvedActiveCommands: MatchingActiveCommands =
      activeCommands ??
      ({
        requestUnmatch: async () => 'error' as const,
        cancelUnmatchRequest: async () => 'error' as const,
        isPending: () => false,
      } satisfies MatchingActiveCommands);
    currentContent = (
      <>
        {requestActionError ? (
          <div
            role="alert"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          >
            <span>{requestActionError}</span>
            {onDismissRequestActionError ? (
              <button
                type="button"
                className="min-h-11 rounded-xl px-3 font-semibold underline underline-offset-4"
                onClick={onDismissRequestActionError}
              >
                닫기
              </button>
            ) : null}
          </div>
        ) : null}
        <SeasonStateRenderer
          state={state}
          requestCommands={commands}
          activeCommands={resolvedActiveCommands}
          activeActionError={activeActionError}
          unmatchCompletion={unmatchCompletion}
          onDismissActiveActionError={onDismissActiveActionError}
          onDismissUnmatchCompletion={onDismissUnmatchCompletion}
          onNavigateChat={onNavigateChat}
          onNavigationIntent={handleNavigationIntent}
          onRefreshOverview={onRetry}
          initialRequestTab={initialRequestTab}
        />
      </>
    );
  }

  return (
    <>
      <div
        className="min-h-full bg-[var(--knu-background-alt)]"
        style={
          {
            '--matching-sticky-stack-height': `${stickyStackHeight}px`,
          } as CSSProperties
        }
      >
        <div ref={stickyStackRef} className="sticky top-0 z-40">
          <MatchingTabHeader
            hero={presentation.hero}
            viewer={viewerHeader}
            deadlineLabel={deadlineLabel}
            showSeasonResidence={state.kind !== 'off-season'}
            onNavigateProfile={
              onNavigationIntent ? () => handleNavigationIntent('profile') : undefined
            }
            sticky={false}
          />
          <div className="border-b border-slate-200/80 bg-[var(--knu-background-alt)]/95 py-3 shadow-sm backdrop-blur">
            <div className="mx-auto w-full max-w-md px-4 min-[361px]:px-5 md:max-w-5xl">
              <MatchingSectionTabs selected={selectedSection} onSelect={handleSectionSelect} />
            </div>
          </div>
        </div>
        <MatchingTabLayout
          width={
            selectedSection === 'past' ||
            state.kind === 'off-season' ||
            state.kind === 'season-open' ||
            state.kind === 'season-matching' ||
            state.kind === 'season-post-match' ||
            state.kind === 'deregistered' ||
            state.kind === 'unavailable' ||
            state.kind === 'error'
              ? 'archive'
              : 'compact'
          }
        >
          <div className="space-y-4">
            {selectedSection === 'past' ? (
              pastContent
            ) : (
              <div
                id="matching-section-panel-current"
                role="tabpanel"
                aria-labelledby="matching-section-tab-current"
              >
                <h2 id="matching-current-section-heading" tabIndex={-1} className="sr-only">
                  현재 매칭
                </h2>
                {currentContent}
              </div>
            )}
          </div>
        </MatchingTabLayout>
      </div>
      <MatchRequestResultDialog
        celebration={celebration}
        completion={requestActionCompletion}
        onCloseCelebration={onCloseCelebration}
        onCloseCompletion={onDismissRequestActionCompletion}
      />
    </>
  );
}

function toMatchingDeadlineLabel(state: MatchingViewState): string | null {
  if (state.kind !== 'season-matching' || !state.current.roomSelectionDate) return null;
  const deadline = Date.parse(`${state.current.roomSelectionDate}T23:59:59.999+09:00`);
  const serverNow = Date.parse(state.current.serverNow);
  if (!Number.isFinite(deadline) || !Number.isFinite(serverNow)) return null;
  const days = Math.max(0, Math.ceil((deadline - serverNow) / 86_400_000));
  return days === 0 ? '오늘 마감' : `D-${days}`;
}

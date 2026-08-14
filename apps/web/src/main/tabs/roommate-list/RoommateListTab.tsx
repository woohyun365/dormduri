'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { formatCampusName } from '@/main/model/profileDisplayCopy';
import { useSeasonContext } from '@/main/contexts/SeasonContext';
import {
  RoommateListControlsPanel,
  RoommateListDesktopAsideSkeleton,
} from './components/search/RoommateListControlsPanel';
import {
  RoommateActionFeedbackBanner,
  RoommateBookmarkErrorBanner,
  getDialogReceipt,
} from './components/search/RoommateSearchFeedback';
import { useDesktopRoommateLayout } from './hooks/useDesktopRoommateLayout';
import { useRoommateActions } from './hooks/useRoommateActions';
import { useRoommateBookmarkList } from './hooks/useRoommateBookmarkList';
import { useRoommateProfileDetail } from './hooks/useRoommateProfileDetail';
import { useRoommateSearch } from './hooks/useRoommateSearch';
import {
  actionDialogErrorMessage,
  isActionDialogSubmitting,
} from './model/actions/roommateActionDialogState';
import {
  getBookmarkOnlyEmptyState,
  getInitialRoommateSearchQuery,
  getRoommateSearchClosedMessage,
  getSearchStateSectionState,
  getSearchSummaryContextLabel,
  toDetailTarget,
} from './model/search/roommateListShellModel';
import { mapRoommateSearchItemsToCardViewModels } from './model/search/roommateSearchViewModel';
import { RoommateActionReceiptDialog } from './overlays/RoommateActionReceiptDialog';
import { RoommateBlockDialog } from './overlays/RoommateBlockDialog';
import { RoommateFilterSheet } from './overlays/RoommateFilterSheet';
import { RoommateMatchRequestDialog } from './overlays/RoommateMatchRequestDialog';
import { RoommateProfileDetailDialog } from './overlays/RoommateProfileDetailDialog';
import { RoommateReportDialog } from './overlays/RoommateReportDialog';
import { RoommateSearchStateSection } from './sections/empty-states/RoommateSearchStateSection';
import { RoommateSearchFilterBar } from './sections/filters/RoommateSearchFilterBar';
import { RoommateSearchHeader } from './sections/header/RoommateSearchHeader';
import { RoommateSearchResultsSection } from './sections/results/RoommateSearchResultsSection';
import { RoommateSearchControls } from './sections/scope-switcher/RoommateSearchControls';
import type { TabId } from '@/main/model/navigation';
import type { UserProfile } from '@/main/model/profile';

interface RoommateListTabProps {
  user: UserProfile;
  onNavigate: (tab: TabId) => void;
  searchEntryAllowed?: boolean;
  viewerSeasonRegistered?: boolean;
  searchClosedMessage?: string;
  sameDormitoryRestrictedEmptyState?: {
    readonly title: string;
    readonly message: string;
  };
}

export default function RoommateListTab({
  user,
  onNavigate,
  searchEntryAllowed = true,
  viewerSeasonRegistered,
  searchClosedMessage,
  sameDormitoryRestrictedEmptyState,
}: RoommateListTabProps) {
  const season = useSeasonContext();
  const headerRef = useRef<HTMLElement | null>(null);
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState(152);
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const closedMessage = getRoommateSearchClosedMessage({
    seasonState: season.state,
    searchEntryAllowed,
    searchClosedMessage,
  });
  const searchClosed = closedMessage !== null;
  const assignedDormitory = user.dormitory?.id === user.dormitoryId ? user.dormitory : null;
  const registeredWithDormitory =
    (viewerSeasonRegistered ?? assignedDormitory !== null) && assignedDormitory !== null;
  const search = useRoommateSearch({
    autoLoad: !searchClosed,
    initialQuery: getInitialRoommateSearchQuery(registeredWithDormitory),
  });
  const activeSearchScope = search.response?.scope ?? search.query.scope;
  const canShowBookmarkToggle =
    registeredWithDormitory && activeSearchScope === 'SAME_BUILDING_ONLY';
  const isBookmarkOnlyMode = showBookmarkedOnly && canShowBookmarkToggle;
  const bookmarks = useRoommateBookmarkList({
    autoLoad: false,
  });
  const detail = useRoommateProfileDetail();
  const actions = useRoommateActions({
    onRefreshSearch: search.refresh,
    onRefreshBookmarks: async () => {},
    onRefreshDetail: async () => {
      detail.retry();
    },
    onCloseDetail: detail.close,
  });
  const showRegistrationEmptyPrompt =
    !registeredWithDormitory && activeSearchScope === 'SAME_BUILDING_ONLY';
  const isSearchLoading = search.status === 'idle' || search.status.startsWith('loading');
  const isReplacingSearchResults =
    search.status === 'idle' ||
    search.status === 'loading-manifest' ||
    search.status === 'loading-search';
  const showInitialSearchSkeleton = isReplacingSearchResults && search.items.length === 0;
  const showSearchControls = !searchClosed && search.status !== 'error';
  const state = getSearchStateSectionState({
    search,
    closedMessage,
    activeSearchScope,
    showRegistrationEmptyPrompt,
    sameDormitoryRestrictedEmptyState,
  });
  const searchCardItems = mapRoommateSearchItemsToCardViewModels(search.items, {
    getBookmarked: bookmarks.getOptimisticBookmarked,
    isPending: bookmarks.isTargetPending,
    summaryContextLabel: getSearchSummaryContextLabel(
      search,
      user,
      assignedDormitory?.name ?? null,
    ),
  });
  const displayedSearchCardItems = isBookmarkOnlyMode
    ? searchCardItems.filter((item) => item.bookmarked)
    : searchCardItems;
  const bookmarkOnlyEmptyState = getBookmarkOnlyEmptyState({
    enabled: isBookmarkOnlyMode,
    status: search.status,
    itemCount: displayedSearchCardItems.length,
  });
  const renderedState = bookmarkOnlyEmptyState ?? state;
  const isDesktopLayout = useDesktopRoommateLayout();
  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const updateHeight = () =>
      setStickyHeaderHeight(Math.ceil(header.getBoundingClientRect().height));
    updateHeight();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  const scopeControls = showSearchControls ? (
    <RoommateSearchControls
      scope={search.query.scope}
      sort={search.query.sort}
      manifest={search.manifest}
      scopeAvailability={search.response?.scopeAvailability ?? search.scopeAvailability}
      disabled={isSearchLoading}
      onScopeChange={(scope) => {
        if (scope !== 'SAME_BUILDING_ONLY') {
          setShowBookmarkedOnly(false);
        }
        void search.changeScope(scope);
      }}
      onSortChange={(sort) => void search.changeSort(sort)}
    />
  ) : null;
  const filterBar =
    showSearchControls && search.manifest?.canOpenFilterSheet === true ? (
      <RoommateSearchFilterBar
        manifest={search.manifest}
        query={search.query}
        disabled={isSearchLoading}
        onOpenFilterSheet={() => setFilterSheetOpen(true)}
        onRemoveFilter={(key) => void search.removeFilter(key)}
        onResetFilters={() => void search.resetFilters()}
      />
    ) : null;

  return (
    <div
      className="min-h-full min-w-0 overflow-x-clip bg-(--knu-background-alt)"
      style={
        {
          '--roommate-sticky-header-height': `${stickyHeaderHeight}px`,
        } as CSSProperties
      }
    >
      <RoommateSearchHeader
        frameRef={headerRef}
        nickname={user.nickname}
        gender={user.gender}
        residenceLabel={
          season.state !== 'OFF_SEASON' && assignedDormitory
            ? `${assignedDormitory.name} · ${assignedDormitory.roomType}인실`
            : null
        }
        campusLabel={formatCampusName(user.campus)}
        onNavigateProfile={() => onNavigate('profile')}
      />

      <div
        className={`mx-auto grid min-w-0 w-full max-w-md gap-5 px-4 pb-8 pt-5 min-[361px]:px-5 md:max-w-5xl ${
          showSearchControls
            ? 'lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.8fr)] lg:items-start'
            : ''
        }`}
      >
        {showSearchControls && !isDesktopLayout ? (
          <RoommateListControlsPanel
            showBookmarkedOnly={isBookmarkOnlyMode}
            showBookmarkToggle={canShowBookmarkToggle}
            disabled={isSearchLoading}
            onBookmarkOnlyChange={setShowBookmarkedOnly}
            variant="mobileControls"
          >
            {scopeControls}
            {filterBar}
          </RoommateListControlsPanel>
        ) : null}

        <main className="min-w-0 space-y-5 lg:order-1" aria-label="룸메이트 찾기 주요 목록">
          <RoommateActionFeedbackBanner
            receipt={actions.lastReceipt}
            error={actions.lastError}
            onDismiss={actions.dismissFeedback}
          />
          <RoommateBookmarkErrorBanner
            message={bookmarks.error?.message ?? null}
            onRetry={() => {
              bookmarks.dismissError();
              void search.refresh();
            }}
            onDismiss={bookmarks.dismissError}
          />

          {renderedState && (renderedState.kind === 'error' || renderedState.kind === 'closed') ? (
            <RoommateSearchStateSection state={renderedState} />
          ) : renderedState ? (
            <RoommateSearchStateSection state={renderedState} />
          ) : (
            <RoommateSearchResultsSection
              items={displayedSearchCardItems}
              canLoadMore={search.canLoadMore}
              isLoadingMore={search.status === 'loading-more'}
              updating={isReplacingSearchResults}
              onLoadMore={() => void search.loadMore()}
              onOpenDetail={(item) => detail.open(toDetailTarget(item))}
              onStartChat={() => onNavigate('chat')}
              onBookmarkToggle={(targetUserId, bookmarked) =>
                void bookmarks.toggleBookmark(targetUserId, bookmarked)
              }
            />
          )}
        </main>

        {showSearchControls && isDesktopLayout ? (
          <aside
            className="space-y-4 lg:sticky lg:top-[calc(var(--roommate-sticky-header-height,152px)+1.25rem)] lg:order-2"
            aria-label="룸메이트 찾기 필터와 보조 정보"
          >
            {showInitialSearchSkeleton ? (
              <RoommateListDesktopAsideSkeleton />
            ) : (
              <>
                {isDesktopLayout ? (
                  <RoommateListControlsPanel
                    showBookmarkedOnly={isBookmarkOnlyMode}
                    showBookmarkToggle={canShowBookmarkToggle}
                    disabled={isSearchLoading}
                    onBookmarkOnlyChange={setShowBookmarkedOnly}
                    variant="desktopAside"
                  >
                    {scopeControls}
                    {filterBar}
                  </RoommateListControlsPanel>
                ) : null}
              </>
            )}
          </aside>
        ) : null}
      </div>

      <RoommateFilterSheet
        isOpen={filterSheetOpen}
        manifest={search.manifest}
        query={search.query}
        disabled={isSearchLoading}
        onClose={() => setFilterSheetOpen(false)}
        onApply={(filters) => void search.applyFilters(filters)}
      />
      <RoommateProfileDetailDialog
        state={detail}
        suspended={actions.activeDialog.kind !== 'closed'}
        onClose={detail.close}
        onRetry={detail.retry}
        onRefreshList={() => void search.refresh()}
        actionPendingTargetIds={actions.pendingTargetUserIds}
        onRequestMatch={actions.openMatchRequestDialog}
        onBlock={actions.openBlockDialog}
        onReport={actions.openReportDialog}
        onStartChat={() => onNavigate('chat')}
        onOpenMatchingRequests={() => onNavigate('matching')}
      />
      <RoommateBlockDialog
        state={actions.activeDialog}
        submitting={isActionDialogSubmitting(actions)}
        errorMessage={actionDialogErrorMessage(actions, 'block')}
        onClose={actions.closeDialog}
        onSubmit={(input) => void actions.submitBlock(input)}
      />
      <RoommateReportDialog
        state={actions.activeDialog}
        submitting={isActionDialogSubmitting(actions)}
        errorMessage={actionDialogErrorMessage(actions, 'report')}
        onClose={actions.closeDialog}
        onSubmit={(input) => void actions.submitReport(input)}
      />
      <RoommateMatchRequestDialog
        state={actions.activeDialog}
        submitting={isActionDialogSubmitting(actions)}
        errorMessage={actionDialogErrorMessage(actions, 'matchRequest')}
        onClose={actions.closeDialog}
        onSubmit={(input) => void actions.submitMatchRequest(input)}
      />
      <RoommateActionReceiptDialog
        receipt={getDialogReceipt(actions.lastReceipt)}
        onDismiss={actions.dismissFeedback}
      />
    </div>
  );
}

'use client';

import { Bookmark, Search } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { CAMPUS_NAMES, getDormitoryById } from '@/constants/dormitory';
import { useSeasonContext, type SeasonContextValue } from '@/main/contexts/SeasonContext';
import { isDormitoryAssigned } from '@/utils/dormitory';
import { useRoommateActions } from './hooks/useRoommateActions';
import { useRoommateBookmarkList } from './hooks/useRoommateBookmarkList';
import { useRoommateProfileDetail } from './hooks/useRoommateProfileDetail';
import { useRoommateSearch, type UseRoommateSearchResult } from './hooks/useRoommateSearch';
import {
  mapRoommateSearchItemsToCardViewModels,
  type RoommateSummaryCardViewModel,
} from './model/search/roommateSearchViewModel';
import { RoommateBlockDialog } from './overlays/RoommateBlockDialog';
import { RoommateFilterSheet } from './overlays/RoommateFilterSheet';
import { RoommateMatchRequestDialog } from './overlays/RoommateMatchRequestDialog';
import { RoommateProfileDetailDialog } from './overlays/RoommateProfileDetailDialog';
import { RoommateReportDialog } from './overlays/RoommateReportDialog';
import { RoommateSearchFilterBar } from './sections/filters/RoommateSearchFilterBar';
import { RoommateSearchHeader } from './sections/header/RoommateSearchHeader';
import { RoommateSearchControls } from './sections/scope-switcher/RoommateSearchControls';
import {
  RoommateSearchStateSection,
  type RoommateSearchStateSectionState,
} from './sections/empty-states/RoommateSearchStateSection';
import { RoommateSearchResultsSection } from './sections/results/RoommateSearchResultsSection';
import type {
  RoommateActionFeedback,
  RoommateActionReceipt,
  UseRoommateActionsResult,
} from './hooks/useRoommateActions';
import type { RoommateActionKind } from './model/actions/roommateActionReasonCopy';
import type { TabId, UserProfile } from '@/types/profile';

const CLOSED_SEARCH_MESSAGE = '지난 시즌 룸메이트 찾기 탐색이 종료되었어요.';
const ENTRY_CLOSED_MESSAGE =
  '현재 상태에서는 룸메이트 찾기 탐색을 열 수 없어요. 시즌 참여 상태를 확인해 주세요.';
const EMPTY_SEARCH_MESSAGE = '조건에 맞는 룸메이트가 아직 없어요.';
const BOOKMARK_ONLY_EMPTY_TITLE = '아직 저장한 후보가 없어요.';
const BOOKMARK_ONLY_EMPTY_MESSAGE =
  '같은 건물 후보 카드의 북마크를 눌러 다시 볼 후보를 저장해 보세요.';
const REGISTRATION_REQUIRED_EMPTY_TITLE = '시즌 등록 후 같은 건물 후보를 볼 수 있어요.';
const REGISTRATION_REQUIRED_EMPTY_MESSAGE =
  '등록을 마치면 같은 건물 후보 리스트와 생활패턴 비교가 열려요.';
const OFF_SEASON_HEADER_TITLE = '룸메이트 찾기 준비 중';
const OFF_SEASON_HEADER_DESCRIPTION = '다음 시즌이 시작되면 안내할게요.';
const SEASON_OPEN_HEADER_TITLE = '룸메이트 찾기 오픈';
const SEASON_OPEN_HEADER_DESCRIPTION =
  '시즌 후보를 둘러보고, 같은 건물 후보는 생활패턴과 조건까지 비교해 볼 수 있어요.';
const DEFAULT_HEADER_DESCRIPTION =
  '원하는 룸메 조건을 바탕으로 생활패턴이 잘 맞는 후보를 탐색할 수 있어요.';
const DESKTOP_ROOMMATE_LAYOUT_QUERY = '(min-width: 1024px)';

interface RoommateListTabProps {
  user: UserProfile;
  onNavigate: (tab: TabId) => void;
  searchEntryAllowed?: boolean;
}

export default function RoommateListTab({
  user,
  onNavigate,
  searchEntryAllowed = true,
}: RoommateListTabProps) {
  const season = useSeasonContext();
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const closedMessage =
    season.state === 'OFF_SEASON'
      ? CLOSED_SEARCH_MESSAGE
      : searchEntryAllowed
        ? null
        : ENTRY_CLOSED_MESSAGE;
  const searchClosed = closedMessage !== null;
  const assignedDormitory = isDormitoryAssigned(user.dormitoryId)
    ? (getDormitoryById(user.dormitoryId) ?? null)
    : null;
  const search = useRoommateSearch({
    autoLoad: !searchClosed,
    initialQuery:
      assignedDormitory !== null
        ? { scope: 'SAME_BUILDING_ONLY', sort: 'MATCH_SCORE' }
        : { scope: 'CAMPUS_MERGED', sort: 'NICKNAME' },
  });
  const activeSearchScope = search.response?.scope ?? search.query.scope;
  const canShowBookmarkToggle =
    assignedDormitory !== null && activeSearchScope === 'SAME_BUILDING_ONLY';
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
  const headerTitle = getRoommateHeaderTitle(season.state, assignedDormitory?.name ?? null);
  const headerDescription = getRoommateHeaderDescription(season.state);
  const showRegistrationEmptyPrompt =
    assignedDormitory === null && activeSearchScope === 'SAME_BUILDING_ONLY';
  const isSearchLoading = search.status === 'idle' || search.status.startsWith('loading');
  const showSearchControls = !searchClosed && search.status !== 'error';
  const showHeaderRuntimeMessages = showSearchControls;
  const state = getSearchStateSectionState({
    search,
    closedMessage,
    showRegistrationEmptyPrompt,
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
  const bookmarkOnlyEmptyState =
    isBookmarkOnlyMode && search.status === 'success' && displayedSearchCardItems.length === 0
      ? ({
          kind: 'empty',
          title: BOOKMARK_ONLY_EMPTY_TITLE,
          message: BOOKMARK_ONLY_EMPTY_MESSAGE,
        } satisfies RoommateSearchStateSectionState)
      : null;
  const renderedState = bookmarkOnlyEmptyState ?? state;
  const isDesktopLayout = useDesktopRoommateLayout();
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
    <div className="min-h-full bg-(--knu-background-alt)">
      <RoommateSearchHeader
        title={headerTitle}
        description={headerDescription}
        statusMessage={search.statusMessage}
        showRuntimeMessages={showHeaderRuntimeMessages}
      />

      <div
        className={`mx-auto grid max-w-6xl gap-5 px-5 pb-8 pt-5 ${
          showSearchControls
            ? 'lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.42fr)] lg:items-start'
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

        <main className="space-y-5 lg:order-1" aria-label="룸메이트 찾기 주요 목록">
          <RoommateActionFeedbackBanner
            receipt={actions.lastReceipt}
            error={actions.lastError}
            onDismiss={actions.dismissFeedback}
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
            className="space-y-4 lg:sticky lg:top-32 lg:order-2"
            aria-label="룸메이트 찾기 필터와 보조 정보"
          >
            {isDesktopLayout && isSearchLoading ? (
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
        viewerLifestyle={user.lifestyle}
        onClose={detail.close}
        onRetry={detail.retry}
        onRefreshList={() => void search.refresh()}
        actionPendingTargetIds={actions.pendingTargetUserIds}
        onRequestMatch={actions.openMatchRequestDialog}
        onBlock={actions.openBlockDialog}
        onReport={actions.openReportDialog}
        onStartChat={() => onNavigate('chat')}
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
    </div>
  );
}

function getRoommateHeaderTitle(
  seasonState: SeasonContextValue['state'],
  assignedDormitoryName: string | null,
): string {
  if (seasonState === 'OFF_SEASON') return OFF_SEASON_HEADER_TITLE;
  if (seasonState === 'SEASON_OPEN') return SEASON_OPEN_HEADER_TITLE;
  return assignedDormitoryName ? `${assignedDormitoryName} 룸메이트` : '룸메이트 찾기';
}

function getRoommateHeaderDescription(seasonState: SeasonContextValue['state']): string {
  if (seasonState === 'OFF_SEASON') return OFF_SEASON_HEADER_DESCRIPTION;
  if (seasonState === 'SEASON_OPEN') {
    return SEASON_OPEN_HEADER_DESCRIPTION;
  }
  return DEFAULT_HEADER_DESCRIPTION;
}

function useDesktopRoommateLayout(): boolean {
  const [isDesktopLayout, setIsDesktopLayout] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_ROOMMATE_LAYOUT_QUERY);
    const updateLayout = () => setIsDesktopLayout(mediaQuery.matches);

    updateLayout();
    mediaQuery.addEventListener('change', updateLayout);
    return () => mediaQuery.removeEventListener('change', updateLayout);
  }, []);

  return isDesktopLayout;
}

function RoommateActionFeedbackBanner({
  receipt,
  error,
  onDismiss,
}: {
  readonly receipt: RoommateActionReceipt | null;
  readonly error: RoommateActionFeedback | null;
  readonly onDismiss: () => void;
}) {
  const feedback = error ?? receipt;
  if (!feedback) return null;
  const isError = error !== null;
  return (
    <section
      role={isError ? 'alert' : 'status'}
      className={`rounded-3xl border bg-white p-4 shadow-sm ${
        isError ? 'border-red-100' : 'border-emerald-100'
      }`}
    >
      <p className={`text-sm font-bold ${isError ? 'text-red-700' : 'text-emerald-700'}`}>
        {feedback.title}
      </p>
      <p className="mt-2 text-xs leading-5 text-(--knu-text-secondary)">{feedback.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-3 rounded-xl border border-(--knu-border) px-3 py-2 text-xs font-semibold text-(--knu-text-secondary)"
      >
        알림 닫기
      </button>
    </section>
  );
}

function isActionDialogSubmitting(actions: UseRoommateActionsResult): boolean {
  const targetId = actions.activeDialog.target?.targetUserId;
  return targetId ? actions.isTargetPending(targetId) : false;
}

function actionDialogErrorMessage(
  actions: UseRoommateActionsResult,
  actionKind: RoommateActionKind,
): string | null {
  if (!actions.lastError || actions.lastError.actionKind !== actionKind) return null;
  return actions.lastError.message;
}

function toDetailTarget(item: RoommateSummaryCardViewModel) {
  return {
    targetUserId: item.targetUserId,
    nickname: item.nickname,
    detailEntryToken: item.detailEntryToken,
  };
}

function RoommateListControlsPanel({
  showBookmarkedOnly,
  showBookmarkToggle,
  disabled,
  onBookmarkOnlyChange,
  variant,
  children,
}: {
  readonly showBookmarkedOnly: boolean;
  readonly showBookmarkToggle: boolean;
  readonly disabled: boolean;
  readonly onBookmarkOnlyChange: (showBookmarkedOnly: boolean) => void;
  readonly variant: 'mobileControls' | 'desktopAside';
  readonly children: ReactNode;
}) {
  const className =
    variant === 'desktopAside'
      ? 'space-y-4 rounded-3xl border border-(--knu-border) bg-white/80 p-4 shadow-sm'
      : 'space-y-4 rounded-none border-y border-(--knu-border) bg-transparent py-4 shadow-none lg:hidden';

  return (
    <section className={className} aria-label="검색 결과 설정">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2">
          <Search className="h-4 w-4 text-(--knu-primary)" aria-hidden />
          <p className="text-sm font-bold text-(--knu-text-primary)">검색 결과</p>
        </div>
        {showBookmarkToggle ? (
          <RoommateBookmarkOnlyToggle
            checked={showBookmarkedOnly}
            disabled={disabled}
            onChange={onBookmarkOnlyChange}
          />
        ) : null}
      </div>
      {children}
    </section>
  );
}

function RoommateListDesktopAsideSkeleton() {
  return (
    <div className="space-y-4" data-testid="roommate-search-desktop-aside-skeleton">
      <section
        className="space-y-5 rounded-3xl border border-(--knu-border) bg-white/80 p-4 shadow-sm"
        aria-label="검색 결과와 조건 필터 로딩 중"
      >
        <div className="grid grid-cols-2 gap-2">
          <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-16 animate-pulse rounded-full bg-slate-200" />
          <div className="flex gap-2">
            <div className="h-9 w-20 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-9 w-20 animate-pulse rounded-xl bg-slate-100" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 w-10 animate-pulse rounded-full bg-slate-200" />
          <div className="flex gap-2">
            <div className="h-9 w-18 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-9 w-20 animate-pulse rounded-xl bg-slate-100" />
          </div>
        </div>
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="h-3 w-16 animate-pulse rounded-full bg-slate-200" />
              <div className="h-3 w-36 animate-pulse rounded-full bg-slate-100" />
            </div>
            <div className="h-8 w-18 animate-pulse rounded-xl bg-slate-100" />
          </div>
          <div className="h-8 animate-pulse rounded-full bg-white shadow-sm" />
        </div>
      </section>
    </div>
  );
}

function RoommateBookmarkOnlyToggle({
  checked,
  disabled,
  onChange,
}: {
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="저장한 후보만 보기"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        checked
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-(--knu-border) bg-white text-(--knu-text-secondary) hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700'
      }`}
    >
      <Bookmark className={`h-4 w-4 ${checked ? 'fill-current' : ''}`} aria-hidden />
      저장한 후보만 보기
    </button>
  );
}

function getSearchStateSectionState({
  search,
  closedMessage,
  showRegistrationEmptyPrompt,
}: {
  readonly search: UseRoommateSearchResult;
  readonly closedMessage: string | null;
  readonly showRegistrationEmptyPrompt: boolean;
}): RoommateSearchStateSectionState | null {
  if (closedMessage) {
    return { kind: 'closed', message: closedMessage };
  }

  if (search.status === 'error') {
    return {
      kind: 'error',
      message: search.error?.message ?? '룸메이트 찾기 정보를 불러오지 못했어요.',
      onRetry: () => void search.refresh(),
    };
  }

  if (
    search.status === 'idle' ||
    search.status === 'loading-manifest' ||
    search.status === 'loading-search'
  ) {
    return { kind: 'loading' };
  }

  if (search.items.length === 0) {
    if (showRegistrationEmptyPrompt) {
      return {
        kind: 'empty',
        title: REGISTRATION_REQUIRED_EMPTY_TITLE,
        message: REGISTRATION_REQUIRED_EMPTY_MESSAGE,
        tone: 'warning',
      };
    }

    const emptyNotice = search.notices.find((notice) => notice.emptyState);
    return {
      kind: 'empty',
      title: emptyNotice?.title ?? EMPTY_SEARCH_MESSAGE,
      message: emptyNotice?.message ?? '탐색 범위나 정렬을 바꿔 다시 확인해 보세요.',
    };
  }

  return null;
}

function getSearchSummaryContextLabel(
  search: UseRoommateSearchResult,
  user: UserProfile,
  assignedDormitoryName: string | null,
): string | null {
  const scope = search.response?.scope ?? search.query.scope;
  if (scope === 'CAMPUS_MERGED') return CAMPUS_NAMES[user.campus];
  if (assignedDormitoryName) return `${assignedDormitoryName} (${genderLabel(user.gender)})`;
  return null;
}

function genderLabel(gender: UserProfile['gender']): string {
  return gender === 'M' ? '남' : '여';
}

'use client';

import { useState } from 'react';
import { getDormitoryById } from '@/constants/dormitory';
import { useSeasonContext } from '@/main/contexts/SeasonContext';
import { isDormitoryAssigned } from '@/utils/dormitory';
import { RoommateListBannerGroup } from './RoommateListBannerGroup';
import { useRoommateActions } from './hooks/useRoommateActions';
import { useRoommateBookmarkList } from './hooks/useRoommateBookmarkList';
import { useRoommateProfileDetail } from './hooks/useRoommateProfileDetail';
import { useRoommateSearch, type UseRoommateSearchResult } from './hooks/useRoommateSearch';
import {
  mapBookmarkListItemsToCardViewModels,
  mapRoommateSearchItemsToCardViewModels,
  type RoommateSummaryCardViewModel,
} from './model/search/roommateSearchViewModel';
import { RoommateBlockDialog } from './overlays/RoommateBlockDialog';
import { RoommateFilterSheet } from './overlays/RoommateFilterSheet';
import { RoommateMatchRequestDialog } from './overlays/RoommateMatchRequestDialog';
import { RoommateProfileDetailDialog } from './overlays/RoommateProfileDetailDialog';
import { RoommateReportDialog } from './overlays/RoommateReportDialog';
import { RoommateBookmarkResultsSection } from './sections/bookmarks/RoommateBookmarkResultsSection';
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

type RoommateListMode = 'search' | 'bookmarks';

const CLOSED_SEARCH_MESSAGE =
  '지금은 룸메이트 찾기 탐색 기간이 아니에요. 이전 매칭 기록은 매칭 현황에서 확인해 주세요.';
const ENTRY_CLOSED_MESSAGE =
  '현재 상태에서는 룸메이트 찾기 탐색을 열 수 없어요. 시즌 참여 상태를 확인해 주세요.';
const EMPTY_SEARCH_MESSAGE = '조건에 맞는 룸메이트가 아직 없어요.';

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
  const [mode, setMode] = useState<RoommateListMode>('search');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const closedMessage =
    season.state === 'OFF_SEASON'
      ? CLOSED_SEARCH_MESSAGE
      : searchEntryAllowed
        ? null
        : ENTRY_CLOSED_MESSAGE;
  const searchClosed = closedMessage !== null;
  const search = useRoommateSearch({ autoLoad: !searchClosed });
  const bookmarks = useRoommateBookmarkList({ autoLoad: !searchClosed && mode === 'bookmarks' });
  const detail = useRoommateProfileDetail();
  const actions = useRoommateActions({
    onRefreshSearch: search.refresh,
    onRefreshBookmarks: bookmarks.refresh,
    onRefreshDetail: async () => {
      detail.retry();
    },
    onCloseDetail: detail.close,
  });
  const assignedDormitory = isDormitoryAssigned(user.dormitoryId)
    ? getDormitoryById(user.dormitoryId)
    : null;
  const headerTitle = assignedDormitory ? `${assignedDormitory.name} 룸메이트` : '룸메이트 찾기';
  const isSearchLoading = search.status === 'idle' || search.status.startsWith('loading');
  const state = getSearchStateSectionState(search, closedMessage);
  const searchCardItems = mapRoommateSearchItemsToCardViewModels(search.items, {
    getBookmarked: bookmarks.getOptimisticBookmarked,
    isPending: bookmarks.isTargetPending,
  });
  const bookmarkCardItems = mapBookmarkListItemsToCardViewModels(bookmarks.items, {
    getBookmarked: bookmarks.getOptimisticBookmarked,
    isPending: bookmarks.isTargetPending,
  });

  return (
    <div>
      <RoommateSearchHeader
        title={headerTitle}
        statusMessage={search.statusMessage}
        notices={search.notices}
        showRuntimeMessages={!searchClosed && mode === 'search'}
      >
        {!searchClosed ? (
          <div className="space-y-4">
            <RoommateListModeSwitch mode={mode} disabled={isSearchLoading} onModeChange={setMode} />
            {mode === 'search' ? (
              <RoommateSearchControls
                scope={search.query.scope}
                sort={search.query.sort}
                manifest={search.manifest}
                scopeAvailability={search.response?.scopeAvailability ?? null}
                disabled={isSearchLoading}
                onScopeChange={(scope) => void search.changeScope(scope)}
                onSortChange={(sort) => void search.changeSort(sort)}
              />
            ) : null}
          </div>
        ) : null}
      </RoommateSearchHeader>

      {!searchClosed ? (
        <RoommateListBannerGroup
          user={user}
          isUnassigned={!assignedDormitory}
          showProfileBanner
          onNavigate={onNavigate}
          filteredProfilesCount={mode === 'search' ? search.items.length : bookmarks.items.length}
        />
      ) : null}

      <div className="mx-auto max-w-md space-y-5 px-5 pb-8">
        {!searchClosed && mode === 'search' ? (
          <RoommateSearchFilterBar
            manifest={search.manifest}
            query={search.query}
            disabled={isSearchLoading}
            onOpenFilterSheet={() => setFilterSheetOpen(true)}
            onRemoveFilter={(key) => void search.removeFilter(key)}
            onResetFilters={() => void search.resetFilters()}
          />
        ) : null}

        <RoommateActionFeedbackBanner
          receipt={actions.lastReceipt}
          error={actions.lastError}
          onDismiss={actions.dismissFeedback}
        />

        {mode === 'bookmarks' && !searchClosed ? (
          <RoommateBookmarkResultsSection
            status={bookmarks.status}
            sort={bookmarks.sort}
            items={bookmarkCardItems}
            emptyState={bookmarks.emptyState}
            error={bookmarks.error}
            canLoadMore={bookmarks.canLoadMore}
            onSortChange={(sort) => void bookmarks.changeSort(sort)}
            onLoadMore={() => void bookmarks.loadMore()}
            onRetry={() => void bookmarks.refresh()}
            onBookmarkToggle={(targetUserId, bookmarked) =>
              void bookmarks.toggleBookmark(targetUserId, bookmarked)
            }
          />
        ) : state ? (
          <RoommateSearchStateSection state={state} />
        ) : (
          <RoommateSearchResultsSection
            items={searchCardItems}
            canLoadMore={search.canLoadMore}
            onLoadMore={() => void search.loadMore()}
            onOpenDetail={(item) => detail.open(toDetailTarget(item))}
            onBookmarkToggle={(targetUserId, bookmarked) =>
              void bookmarks.toggleBookmark(targetUserId, bookmarked)
            }
          />
        )}
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
      <p className="mt-2 text-xs leading-5 text-[var(--knu-text-secondary)]">{feedback.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-3 rounded-xl border border-[var(--knu-border)] px-3 py-2 text-xs font-semibold text-[var(--knu-text-secondary)]"
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

function RoommateListModeSwitch({
  mode,
  disabled,
  onModeChange,
}: {
  readonly mode: RoommateListMode;
  readonly disabled: boolean;
  readonly onModeChange: (mode: RoommateListMode) => void;
}) {
  return (
    <div
      className="flex rounded-2xl bg-[var(--knu-background-alt)] p-1"
      role="group"
      aria-label="목록 모드"
    >
      {(
        [
          ['search', '검색 결과'],
          ['bookmarks', '관심 목록'],
        ] as const
      ).map(([nextMode, label]) => (
        <button
          key={nextMode}
          type="button"
          disabled={disabled || mode === nextMode}
          onClick={() => onModeChange(nextMode)}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
            mode === nextMode
              ? 'bg-white text-[var(--knu-primary)] shadow-sm'
              : 'text-[var(--knu-text-secondary)] hover:bg-white/60'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function getSearchStateSectionState(
  search: UseRoommateSearchResult,
  closedMessage: string | null,
): RoommateSearchStateSectionState | null {
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

  if (search.status === 'idle' || search.status.startsWith('loading')) {
    return { kind: 'loading' };
  }

  if (search.items.length === 0) {
    const emptyNotice = search.notices.find((notice) => notice.emptyState);
    return {
      kind: 'empty',
      title: emptyNotice?.title ?? EMPTY_SEARCH_MESSAGE,
      message: emptyNotice?.message ?? '탐색 범위나 정렬을 바꿔 다시 확인해 보세요.',
    };
  }

  return null;
}

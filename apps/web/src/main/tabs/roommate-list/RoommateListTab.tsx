'use client';

import { useState } from 'react';
import { getDormitoryById } from '@/constants/dormitory';
import { useSeasonContext } from '@/main/contexts/SeasonContext';
import { isDormitoryAssigned } from '@/utils/dormitory';
import { RoommateListBannerGroup } from './RoommateListBannerGroup';
import { useRoommateBookmarkList } from './hooks/useRoommateBookmarkList';
import { useRoommateSearch, type UseRoommateSearchResult } from './hooks/useRoommateSearch';
import {
  mapBookmarkListItemsToCardViewModels,
  mapRoommateSearchItemsToCardViewModels,
} from './model/search/roommateSearchViewModel';
import { RoommateFilterSheet } from './overlays/RoommateFilterSheet';
import { RoommateBookmarkResultsSection } from './sections/bookmarks/RoommateBookmarkResultsSection';
import { RoommateSearchFilterBar } from './sections/filters/RoommateSearchFilterBar';
import { RoommateSearchHeader } from './sections/header/RoommateSearchHeader';
import { RoommateSearchControls } from './sections/scope-switcher/RoommateSearchControls';
import {
  RoommateSearchStateSection,
  type RoommateSearchStateSectionState,
} from './sections/empty-states/RoommateSearchStateSection';
import { RoommateSearchResultsSection } from './sections/results/RoommateSearchResultsSection';
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
    </div>
  );
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

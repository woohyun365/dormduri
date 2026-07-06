'use client';

import { getDormitoryById } from '@/constants/dormitory';
import { useSeasonContext } from '@/main/contexts/SeasonContext';
import { isDormitoryAssigned } from '@/utils/dormitory';
import { RoommateListBannerGroup } from './RoommateListBannerGroup';
import { useRoommateSearch, type UseRoommateSearchResult } from './hooks/useRoommateSearch';
import { mapRoommateSearchItemsToCardViewModels } from './model/search/roommateSearchViewModel';
import { RoommateSearchHeader } from './sections/header/RoommateSearchHeader';
import { RoommateSearchControls } from './sections/scope-switcher/RoommateSearchControls';
import {
  RoommateSearchStateSection,
  type RoommateSearchStateSectionState,
} from './sections/empty-states/RoommateSearchStateSection';
import { RoommateSearchResultsSection } from './sections/results/RoommateSearchResultsSection';
import type { TabId, UserProfile } from '@/types/profile';

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
  const closedMessage =
    season.state === 'OFF_SEASON'
      ? CLOSED_SEARCH_MESSAGE
      : searchEntryAllowed
        ? null
        : ENTRY_CLOSED_MESSAGE;
  const searchClosed = closedMessage !== null;
  const search = useRoommateSearch({ autoLoad: !searchClosed });
  const assignedDormitory = isDormitoryAssigned(user.dormitoryId)
    ? getDormitoryById(user.dormitoryId)
    : null;
  const headerTitle = assignedDormitory ? `${assignedDormitory.name} 룸메이트` : '룸메이트 찾기';
  const isLoading = search.status === 'idle' || search.status.startsWith('loading');
  const state = getSearchStateSectionState(search, closedMessage);
  const cardItems = mapRoommateSearchItemsToCardViewModels(search.items);

  return (
    <div>
      <RoommateSearchHeader
        title={headerTitle}
        statusMessage={search.statusMessage}
        notices={search.notices}
        showRuntimeMessages={!searchClosed}
      >
        {!searchClosed ? (
          <RoommateSearchControls
            scope={search.query.scope}
            sort={search.query.sort}
            manifest={search.manifest}
            scopeAvailability={search.response?.scopeAvailability ?? null}
            disabled={isLoading}
            onScopeChange={(scope) => void search.changeScope(scope)}
            onSortChange={(sort) => void search.changeSort(sort)}
          />
        ) : null}
      </RoommateSearchHeader>

      {!searchClosed ? (
        <RoommateListBannerGroup
          user={user}
          isUnassigned={!assignedDormitory}
          showProfileBanner
          onNavigate={onNavigate}
          filteredProfilesCount={search.items.length}
        />
      ) : null}

      <div className="mx-auto max-w-md px-5 pb-8">
        {state ? (
          <RoommateSearchStateSection state={state} />
        ) : (
          <RoommateSearchResultsSection
            items={cardItems}
            canLoadMore={search.canLoadMore}
            onLoadMore={() => void search.loadMore()}
          />
        )}
      </div>
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

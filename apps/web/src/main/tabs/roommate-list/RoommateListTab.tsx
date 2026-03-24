'use client';

import { useState } from 'react';
import { DEFAULT_FILTERS } from '../../components/BottomSheet';
import { BottomSheet } from '../../components/BottomSheet';
import { ProfileDetailSheet } from '../../components/profile-detail/ProfileDetailSheet';
import { MatchRequestDialog } from '../../components/MatchRequestDialog';
import { useRoommateListViewModel } from './useRoommateListViewModel';
import { RoommateListHeader } from './RoommateListHeader';
import { RoommateListBannerGroup } from './RoommateListBannerGroup';
import { RoommateListResults } from './RoommateListResults';
import type { RoommateProfile } from '@/types/profile';
import type { MatchScoreType } from '@/utils/matchScore';
import type { FilterState } from '@/types/filter';
import type { TabId, UserProfile } from '@/types/profile';
import type { ReportReason } from '@/types/report';
import type { MatchRequest, ActiveMatch } from '@/types/match';
import type { SortMode, ViewMode } from './useRoommateListViewModel';

export type { SortMode, ViewMode } from './useRoommateListViewModel';

interface RoommateListTabProps {
  user: UserProfile;
  onNavigate: (tab: TabId) => void;
  profiles: Omit<RoommateProfile, 'matchScore'>[];
  sortMode: SortMode;
  onSortModeChange: (sortMode: SortMode) => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  viewMode: ViewMode;
  onViewModeChange: (viewMode: ViewMode) => void;
  blockedUserIds?: Set<string>;
  onBlock?: (userId: string, nickname: string) => void;
  onReport?: (userId: string, reason: ReportReason, detail: string | null) => void;
  matchRequests?: MatchRequest[];
  activeMatch?: ActiveMatch | null;
  isSeasonActive: boolean;
  onSendRequest?: (targetUserId: string, message?: string | null) => void;
  bookmarkedUserIds?: Set<string>;
  onToggleBookmark?: (userId: string) => void;
  showProfileBanner?: boolean;
  onDismissProfileBanner?: () => void;
  showMatchScoreTip?: boolean;
  onDismissMatchScoreTip?: () => void;
  showMatchRequestTip?: boolean;
  onDismissMatchRequestTip?: () => void;
}

export default function RoommateListTab({
  user,
  onNavigate,
  profiles: rawProfiles,
  sortMode,
  onSortModeChange,
  filters,
  onFiltersChange,
  viewMode,
  onViewModeChange,
  blockedUserIds,
  onBlock,
  onReport,
  matchRequests = [],
  activeMatch = null,
  isSeasonActive,
  onSendRequest,
  bookmarkedUserIds,
  onToggleBookmark,
  showProfileBanner = true,
  onDismissProfileBanner,
  showMatchScoreTip,
  onDismissMatchScoreTip,
  showMatchRequestTip,
  onDismissMatchRequestTip,
}: RoommateListTabProps) {
  const {
    filteredProfiles,
    isUnassigned,
    headerTitle,
    dormName,
    activeFilters,
    activeFilterCount,
    getFilterLabel,
    getButtonState,
  } = useRoommateListViewModel({
    rawProfiles,
    user,
    filters,
    sortMode,
    viewMode,
    blockedUserIds,
    bookmarkedUserIds,
    matchRequests,
    activeMatch,
    isSeasonActive,
  });

  const [showFilters, setShowFilters] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<
    (RoommateProfile & { scoreType?: MatchScoreType }) | null
  >(null);
  const [displayCount, setDisplayCount] = useState(20);
  const [confirmTarget, setConfirmTarget] = useState<RoommateProfile | null>(null);

  const handleConfirmSend = (message: string | null) => {
    if (confirmTarget && onSendRequest) {
      onSendRequest(confirmTarget.id, message);
    }
  };

  return (
    <div>
      <RoommateListHeader
        headerTitle={headerTitle}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        sortMode={sortMode}
        onSortModeChange={onSortModeChange}
        onOpenFilters={() => setShowFilters(true)}
        activeFilters={activeFilters}
        activeFilterCount={activeFilterCount}
        getFilterLabel={getFilterLabel}
        onRemoveFilter={(field) => onFiltersChange({ ...filters, [field]: null })}
        onResetFilters={() => onFiltersChange(DEFAULT_FILTERS)}
        showViewModeTabs={!!onToggleBookmark}
        bookmarkedCount={bookmarkedUserIds?.size ?? 0}
      />

      <RoommateListBannerGroup
        user={user}
        isUnassigned={isUnassigned}
        showProfileBanner={showProfileBanner}
        onDismissProfileBanner={onDismissProfileBanner}
        onNavigate={onNavigate}
        showMatchScoreTip={showMatchScoreTip}
        onDismissMatchScoreTip={onDismissMatchScoreTip}
        filteredProfilesCount={filteredProfiles.length}
      />

      <RoommateListResults
        filteredProfiles={filteredProfiles}
        displayCount={displayCount}
        onLoadMore={() => setDisplayCount((prev) => prev + 20)}
        viewMode={viewMode}
        dormName={dormName ?? null}
        isUnassigned={isUnassigned}
        getButtonState={getButtonState}
        bookmarkedUserIds={bookmarkedUserIds}
        onToggleBookmark={onToggleBookmark}
        onSelectProfile={setSelectedProfile}
        onRequestMatch={setConfirmTarget}
        onViewModeChange={onViewModeChange}
      />

      <BottomSheet
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onFilterChange={onFiltersChange}
        onApply={() => setShowFilters(false)}
        onReset={() => onFiltersChange(DEFAULT_FILTERS)}
      />

      <ProfileDetailSheet
        profile={selectedProfile}
        scoreType={selectedProfile?.scoreType}
        isOpen={selectedProfile !== null}
        onClose={() => setSelectedProfile(null)}
        onRequestMatch={() => {
          if (selectedProfile) setConfirmTarget(selectedProfile);
        }}
        disabled={isUnassigned}
        matchButtonState={
          selectedProfile && !isUnassigned ? getButtonState(selectedProfile) : undefined
        }
        onBlock={(userId, nickname) => {
          onBlock?.(userId, nickname);
          setSelectedProfile(null);
        }}
        onReport={(userId, reason, detail) => {
          onReport?.(userId, reason, detail);
          setSelectedProfile(null);
        }}
        isBookmarked={selectedProfile ? bookmarkedUserIds?.has(selectedProfile.id) : undefined}
        onToggleBookmark={
          selectedProfile && onToggleBookmark
            ? () => onToggleBookmark(selectedProfile.id)
            : undefined
        }
        userLifestyle={user.lifestyle}
        showMatchRequestTip={showMatchRequestTip}
        onDismissMatchRequestTip={onDismissMatchRequestTip}
      />

      <MatchRequestDialog
        isOpen={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleConfirmSend}
        targetNickname={confirmTarget?.nickname ?? ''}
      />
    </div>
  );
}

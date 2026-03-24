import { Bookmark, Search } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { UserCard } from '../../components/UserCard';
import type { RoommateProfile } from '@/types/profile';
import type { MatchButtonState } from '@/types/match';
import type { MatchScoreType } from '@/utils/matchScore';
import type { ViewMode } from './useRoommateListViewModel';

interface RoommateListResultsProps {
  filteredProfiles: (RoommateProfile & { scoreType?: MatchScoreType })[];
  displayCount: number;
  onLoadMore: () => void;
  viewMode: ViewMode;
  dormName: string | null;
  isUnassigned: boolean;
  getButtonState: (profile: RoommateProfile) => MatchButtonState;
  bookmarkedUserIds?: Set<string>;
  onToggleBookmark?: (userId: string) => void;
  onSelectProfile: (profile: RoommateProfile) => void;
  onRequestMatch: (profile: RoommateProfile) => void;
  onViewModeChange: (viewMode: ViewMode) => void;
}

export function RoommateListResults({
  filteredProfiles,
  displayCount,
  onLoadMore,
  viewMode,
  dormName,
  isUnassigned,
  getButtonState,
  bookmarkedUserIds,
  onToggleBookmark,
  onSelectProfile,
  onRequestMatch,
  onViewModeChange,
}: RoommateListResultsProps) {
  return (
    <>
      <div className="max-w-md mx-auto px-5 pb-5 space-y-3">
        {filteredProfiles.length === 0 ? (
          <EmptyState
            icon={
              viewMode === 'bookmarked' ? (
                <Bookmark className="w-8 h-8 text-[var(--knu-text-tertiary)]" />
              ) : (
                <Search className="w-8 h-8 text-[var(--knu-text-tertiary)]" />
              )
            }
            message={
              viewMode === 'bookmarked'
                ? '관심 목록이 비어있어요'
                : dormName
                  ? `${dormName}에 아직 등록한 사용자가 없어요`
                  : '조건에 맞는 사용자가 없어요. 필터를 조정해보세요'
            }
            action={
              viewMode === 'bookmarked'
                ? { label: '룸메이트 둘러보기', onClick: () => onViewModeChange('all') }
                : undefined
            }
          />
        ) : (
          <>
            {filteredProfiles.slice(0, displayCount).map((profile) => {
              const btnState = getButtonState(profile);
              return (
                <UserCard
                  key={profile.id}
                  profile={profile}
                  scoreType={profile.scoreType}
                  onClick={() => onSelectProfile(profile)}
                  onRequestMatch={() => onRequestMatch(profile)}
                  disabled={isUnassigned}
                  matchButtonState={isUnassigned ? undefined : btnState}
                  isBookmarked={bookmarkedUserIds?.has(profile.id)}
                  onToggleBookmark={
                    onToggleBookmark ? () => onToggleBookmark(profile.id) : undefined
                  }
                />
              );
            })}
            {filteredProfiles.length > displayCount && (
              <button
                onClick={onLoadMore}
                className="w-full py-3 text-sm font-semibold text-[var(--knu-primary)] bg-white border-2 border-[var(--knu-border)] rounded-2xl hover:border-[var(--knu-primary)] transition-all"
              >
                더 보기 ({filteredProfiles.length - displayCount}명 남음)
              </button>
            )}
          </>
        )}
      </div>

      {filteredProfiles.length > 0 && filteredProfiles.length <= displayCount && (
        <div className="text-center py-4 text-sm text-[var(--knu-text-tertiary)]">
          더 이상 표시할 프로필이 없어요
        </div>
      )}
    </>
  );
}

'use client';

import { useState, useMemo } from 'react';
import { Bookmark, Filter, Building2, ChevronRight, Search, X } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { UserCard } from '../components/UserCard';
import { BottomSheet, DEFAULT_FILTERS } from '../components/BottomSheet';
import { ProfileDetailSheet } from '../components/ProfileDetailSheet';
import { UNASSIGNED_ID, getDormitoryById } from '@/constants/dormitory';
import { LIFESTYLE_LABELS, LIFESTYLE_FIELD_NAMES } from '@/constants/lifestyle';
import { CURRENT_SEASON } from '@/constants/season';
import { calcMatchScore } from '@/utils/matchScore';
import { getMatchButtonState } from '@/utils/matchRequest';
import { mockRawProfiles } from '@/__fixtures__/profiles';
import type { RoommateProfile } from '@/types/profile';
import type { FilterState } from '@/types/filter';
import type { TabId, UserProfile } from '@/types/profile';
import type { ReportReason } from '@/types/report';
import type { MatchRequest, ActiveMatch } from '@/types/match';

interface RoommateListTabProps {
  user: UserProfile;
  onNavigate: (tab: TabId) => void;
  blockedUserIds?: Set<string>;
  onBlock?: (userId: string, nickname: string) => void;
  onReport?: (userId: string, reason: ReportReason, detail: string | null) => void;
  matchRequests?: MatchRequest[];
  activeMatch?: ActiveMatch | null;
  onSendRequest?: (targetUserId: string) => void;
  bookmarkedUserIds?: Set<string>;
  onToggleBookmark?: (userId: string) => void;
}

type SortMode = 'match' | 'recent';
type ViewMode = 'all' | 'bookmarked';

export default function RoommateListTab({
  user,
  onNavigate,
  blockedUserIds,
  onBlock,
  onReport,
  matchRequests = [],
  activeMatch = null,
  onSendRequest,
  bookmarkedUserIds,
  onToggleBookmark,
}: RoommateListTabProps) {
  const isUnassigned = !user.dormitoryId || user.dormitoryId === UNASSIGNED_ID;

  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sortMode, setSortMode] = useState<SortMode>('match');
  const [selectedProfile, setSelectedProfile] = useState<RoommateProfile | null>(null);
  const [displayCount, setDisplayCount] = useState(20);
  const [confirmTarget, setConfirmTarget] = useState<RoommateProfile | null>(null);

  // Build profiles with calculated match scores
  const profiles = useMemo<RoommateProfile[]>(
    () =>
      mockRawProfiles.map((p) => ({
        ...p,
        matchScore: calcMatchScore(user.lifestyle, p.lifestyle),
      })),
    [user.lifestyle],
  );

  // Dormitory filter: assigned → own building only, unassigned → all
  const effectiveDormId = isUnassigned ? null : user.dormitoryId;

  // Filter
  const filteredProfiles = useMemo(() => {
    let list = profiles;

    // Blocked user filter
    if (blockedUserIds && blockedUserIds.size > 0) {
      list = list.filter((p) => !blockedUserIds.has(p.id));
    }

    // Bookmark filter
    if (viewMode === 'bookmarked' && bookmarkedUserIds) {
      list = list.filter((p) => bookmarkedUserIds.has(p.id));
    }

    // Dormitory filter (관심목록 모드에서는 건물 무관하게 표시)
    if (effectiveDormId && viewMode !== 'bookmarked') {
      list = list.filter((p) => p.dormitoryId === effectiveDormId);
    }

    // Lifestyle filters
    list = list.filter((p) => {
      for (const key of Object.keys(filters) as (keyof FilterState)[]) {
        const filterVal = filters[key];
        if (filterVal === null) continue;
        if (key === 'sleepHabit' && filterVal === 'HAS') {
          if (p.lifestyle.sleepHabit === 'NONE' || p.lifestyle.sleepHabit === null) return false;
        } else if (p.lifestyle[key] !== filterVal) {
          return false;
        }
      }
      return true;
    });

    // Sort
    if (sortMode === 'match') {
      list = [...list].sort((a, b) => b.matchScore - a.matchScore);
    }

    return list;
  }, [profiles, effectiveDormId, filters, sortMode, blockedUserIds, viewMode, bookmarkedUserIds]);

  const dormName = effectiveDormId ? getDormitoryById(effectiveDormId)?.name : null;

  const activeFilters = (Object.entries(filters) as [keyof FilterState, string | null][]).filter(
    ([, v]) => v !== null,
  );
  const activeFilterCount = activeFilters.length;

  const getFilterLabel = (field: keyof FilterState, value: string): string => {
    if (field === 'sleepHabit' && value === 'HAS') return '있음';
    return LIFESTYLE_LABELS[field][value] ?? value;
  };

  const removeFilter = (field: keyof FilterState) => {
    setFilters((prev) => ({ ...prev, [field]: null }));
  };

  const headerTitle = isUnassigned ? '룸메이트 찾기' : `${dormName ?? ''} 룸메이트`;

  // Normalize UNASSIGNED_ID to null for dormitory comparison
  const normalizeDormId = (id: string | null) => (!id || id === UNASSIGNED_ID ? null : id);

  // Match button state for a given profile
  const getButtonState = (profile: RoommateProfile) =>
    getMatchButtonState({
      targetUserId: profile.id,
      targetDormitoryId: normalizeDormId(profile.dormitoryId),
      userDormitoryId: normalizeDormId(user.dormitoryId),
      requests: matchRequests,
      activeMatch,
      blockedUserIds: blockedUserIds ?? new Set(),
      isSeasonActive: CURRENT_SEASON.isActive,
    });

  const handleRequestMatch = (profile: RoommateProfile) => {
    setConfirmTarget(profile);
  };

  const handleConfirmSend = () => {
    if (confirmTarget && onSendRequest) {
      onSendRequest(confirmTarget.id);
    }
  };

  return (
    <div>
      {/* Header */}
      <div
        role="banner"
        className="bg-white border-b-2 border-[var(--knu-border)] px-5 py-4 sticky top-0 z-40"
      >
        <div className="mb-3">
          <h1 className="text-2xl font-bold text-[var(--knu-text-primary)]">{headerTitle}</h1>
        </div>

        {/* Segment tabs: 전체 / 관심목록 */}
        {onToggleBookmark && (
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setViewMode('all')}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                viewMode === 'all'
                  ? 'bg-[var(--knu-primary)] text-white'
                  : 'bg-[var(--knu-background-alt)] text-[var(--knu-text-secondary)]'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setViewMode('bookmarked')}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                viewMode === 'bookmarked'
                  ? 'bg-[var(--knu-primary)] text-white'
                  : 'bg-[var(--knu-background-alt)] text-[var(--knu-text-secondary)]'
              }`}
            >
              관심목록
              {bookmarkedUserIds && bookmarkedUserIds.size > 0 ? ` ${bookmarkedUserIds.size}` : ''}
            </button>
          </div>
        )}

        {/* Filter button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(true)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 transition-all flex-shrink-0 ${
              activeFilterCount > 0
                ? 'bg-[var(--knu-primary)] text-white border-[var(--knu-primary)]'
                : 'bg-white text-[var(--knu-text-secondary)] border-[var(--knu-border)]'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="text-sm font-semibold">
              필터{activeFilterCount > 0 ? ` ${activeFilterCount}` : ''}
            </span>
          </button>

          {/* Sort toggle */}
          <button
            onClick={() => setSortMode('match')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              sortMode === 'match'
                ? 'bg-[var(--knu-primary)] text-white'
                : 'bg-[var(--knu-background-alt)] text-[var(--knu-text-secondary)]'
            }`}
          >
            매칭도순
          </button>
          <button
            onClick={() => setSortMode('recent')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              sortMode === 'recent'
                ? 'bg-[var(--knu-primary)] text-white'
                : 'bg-[var(--knu-background-alt)] text-[var(--knu-text-secondary)]'
            }`}
          >
            최근 가입순
          </button>
        </div>

        {/* Active Filter Chips */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {activeFilters.map(([field, value]) => (
              <button
                key={field}
                type="button"
                onClick={() => removeFilter(field)}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--knu-primary-light)] text-[var(--knu-primary)] text-xs font-semibold rounded-full hover:bg-[var(--knu-primary)] hover:text-white transition-colors"
              >
                {LIFESTYLE_FIELD_NAMES[field]}: {getFilterLabel(field, value!)}
                <X className="w-3 h-3" />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-[var(--knu-text-tertiary)] hover:text-red-500 transition-colors"
            >
              전체 해제
            </button>
          </div>
        )}
      </div>

      {/* Unassigned Banner */}
      {isUnassigned && (
        <div className="max-w-md mx-auto px-5 pt-5">
          <div className="flex items-start gap-3 p-4 bg-orange-50 border-2 border-orange-200 rounded-2xl">
            <Building2 className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-orange-800 mb-1">건물을 먼저 선택해주세요</p>
              <p className="text-xs text-orange-700 leading-relaxed mb-2">
                같은 건물 사용자만 룸메이트 매칭이 가능해요. 건물을 선택하면 맞춤 추천을 받을 수
                있어요.
              </p>
              <button
                onClick={() => onNavigate('profile')}
                className="flex items-center gap-1 text-sm font-semibold text-orange-700 hover:underline cursor-pointer"
              >
                배정 건물 등록하기
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile List */}
      <div className="max-w-md mx-auto px-5 py-5 space-y-3">
        {filteredProfiles.length > 0 && (
          <p className="text-sm text-[var(--knu-text-tertiary)] font-medium">
            {filteredProfiles.length}명의 룸메이트
          </p>
        )}
      </div>
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
          />
        ) : (
          <>
            {filteredProfiles.slice(0, displayCount).map((profile) => {
              const btnState = getButtonState(profile);
              return (
                <UserCard
                  key={profile.id}
                  profile={profile}
                  onClick={() => setSelectedProfile(profile)}
                  onRequestMatch={() => handleRequestMatch(profile)}
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
                onClick={() => setDisplayCount((prev) => prev + 20)}
                className="w-full py-3 text-sm font-semibold text-[var(--knu-primary)] bg-white border-2 border-[var(--knu-border)] rounded-2xl hover:border-[var(--knu-primary)] transition-all"
              >
                더 보기 ({filteredProfiles.length - displayCount}명 남음)
              </button>
            )}
          </>
        )}
      </div>

      {/* List End */}
      {filteredProfiles.length > 0 && filteredProfiles.length <= displayCount && (
        <div className="text-center py-4 text-sm text-[var(--knu-text-tertiary)]">
          더 이상 표시할 프로필이 없어요
        </div>
      )}

      {/* Bottom Sheet Filter */}
      <BottomSheet
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onFilterChange={setFilters}
        onApply={() => setShowFilters(false)}
        onReset={() => setFilters(DEFAULT_FILTERS)}
      />

      {/* Profile Detail Sheet */}
      <ProfileDetailSheet
        profile={selectedProfile}
        isOpen={selectedProfile !== null}
        onClose={() => setSelectedProfile(null)}
        onRequestMatch={() => {
          if (selectedProfile) handleRequestMatch(selectedProfile);
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
      />

      {/* Match Request Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleConfirmSend}
        title="매칭 요청"
        message={`${confirmTarget?.nickname ?? ''}님에게 매칭 요청을 보내시겠습니까?\n\n요청은 48시간 후 자동 만료됩니다.`}
        confirmLabel="요청 보내기"
      />
    </div>
  );
}

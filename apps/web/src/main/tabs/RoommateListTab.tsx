'use client';

import { useState, useMemo, useEffect } from 'react';
import { Filter, Building2, ChevronRight, Search } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { UserCard } from '../components/UserCard';
import { BottomSheet, DEFAULT_FILTERS } from '../components/BottomSheet';
import { ProfileDetailSheet } from '../components/ProfileDetailSheet';
import { UNASSIGNED_ID, getDormitoryById } from '@/constants/dormitory';
import { calcMatchScore } from '@/utils/matchScore';
import { mockRawProfiles } from '@/__fixtures__/profiles';
import type { RoommateProfile } from '@/types/profile';
import type { FilterState } from '@/types/filter';
import type { TabId, UserProfile } from '@/types/profile';

interface RoommateListTabProps {
  user: UserProfile;
  onNavigate: (tab: TabId) => void;
}

type SortMode = 'match' | 'recent';

export default function RoommateListTab({ user, onNavigate }: RoommateListTabProps) {
  const isUnassigned = !user.dormitoryId || user.dormitoryId === UNASSIGNED_ID;

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sortMode, setSortMode] = useState<SortMode>('match');
  const [selectedProfile, setSelectedProfile] = useState<RoommateProfile | null>(null);
  const [displayCount, setDisplayCount] = useState(20);

  // 스크롤 초기화는 Main.tsx에서 탭 전환 시 처리

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

    // Dormitory filter
    if (effectiveDormId) {
      list = list.filter((p) => p.dormitoryId === effectiveDormId);
    }

    // Lifestyle filters
    list = list.filter((p) => {
      for (const key of Object.keys(filters) as (keyof FilterState)[]) {
        const filterVal = filters[key];
        if (filterVal !== null && p.lifestyle[key] !== filterVal) {
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
  }, [profiles, effectiveDormId, filters, sortMode]);

  const dormName = effectiveDormId ? getDormitoryById(effectiveDormId)?.name : null;

  const activeFilterCount = Object.values(filters).filter((v) => v !== null).length;

  const headerTitle = isUnassigned ? '룸메이트 찾기' : `${dormName ?? ''} 룸메이트`;

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

        {/* Filter button only (dormitory chips removed) */}
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
        {filteredProfiles.length === 0 ? (
          <EmptyState
            icon={<Search className="w-8 h-8 text-[var(--knu-text-tertiary)]" />}
            message={
              dormName
                ? `${dormName}에 아직 등록한 사용자가 없어요`
                : '조건에 맞는 사용자가 없어요. 필터를 조정해보세요'
            }
          />
        ) : (
          <>
            {filteredProfiles.slice(0, displayCount).map((profile) => (
              <UserCard
                key={profile.id}
                profile={profile}
                onClick={() => setSelectedProfile(profile)}
                onRequestMatch={() => {}}
                disabled={isUnassigned}
              />
            ))}
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
        onRequestMatch={() => {}}
        disabled={isUnassigned}
      />
    </div>
  );
}

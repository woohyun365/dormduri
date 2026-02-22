'use client';

import { useState, useMemo, useEffect } from 'react';
import { Filter, Building2, ChevronRight, Search } from 'lucide-react';
import { UserCard } from '../components/UserCard';
import { SkeletonCard } from '../components/SkeletonCard';
import { BottomSheet, DEFAULT_FILTERS } from '../components/BottomSheet';
import { ProfileDetailSheet } from '../components/ProfileDetailSheet';
import { UNASSIGNED_ID, getDormitoryById } from '@/constants/dormitory';
import { calcMatchScore } from '../utils/matchScore';
import type { RoommateProfile } from '../components/UserCard';
import type { FilterState } from '../components/BottomSheet';
import type { TabId, UserProfile } from '../Main';

interface RoommateListTabProps {
  user: UserProfile;
  onNavigate: (tab: TabId) => void;
}

type SortMode = 'match' | 'recent';

const mockRawProfiles: Omit<RoommateProfile, 'matchScore'>[] = [
  {
    id: '1',
    nickname: '조용한하루',
    gender: 'M',
    dormitoryId: 'dasan',
    lifestyle: {
      smoker: 'NO',
      sleepHabit: 'NONE',
      indoorEating: 'OK',
      bedtime: '22_24',
      wakeTime: '06_08',
      noiseSensitivity: 'MID',
      cleanliness: 'HIGH',
      relationshipStyle: 'CLOSE',
    },
    intro: '조용하고 규칙적인 생활을 선호합니다. 서로 존중하며 지낼 룸메이트를 찾습니다.',
    messageToRoommate: '쓰레기통, 청소도구 제가 가져갑니다!',
    additional: { college: 'IT대', grade: '2', mbti: 'ISTJ', temperatureSensitivity: 'COLD' },
  },
  {
    id: '2',
    nickname: '겜돌이',
    gender: 'M',
    dormitoryId: 'dasan',
    lifestyle: {
      smoker: 'NO',
      sleepHabit: 'TALKING',
      indoorEating: 'VENTILATE',
      bedtime: '24_02',
      wakeTime: '08_10',
      noiseSensitivity: 'LOW',
      cleanliness: 'MID',
      relationshipStyle: 'CASUAL',
    },
    intro: '게임을 좋아하지만 이어폰 사용합니다. 배려하며 지낼 분 구해요!',
    messageToRoommate: null,
    additional: { college: 'IT대', grade: '1', mbti: 'INTP', temperatureSensitivity: null },
  },
  {
    id: '3',
    nickname: '새벽러너',
    gender: 'M',
    dormitoryId: 'toegye',
    lifestyle: {
      smoker: 'NO',
      sleepHabit: 'NONE',
      indoorEating: 'NO',
      bedtime: 'BEFORE_22',
      wakeTime: 'BEFORE_06',
      noiseSensitivity: 'HIGH',
      cleanliness: 'HIGH',
      relationshipStyle: 'CASUAL',
    },
    intro: '새벽 운동을 즐기고, 청결을 중요하게 생각합니다.',
    messageToRoommate: '화장실 슬리퍼 같이 쓸 분 구해요',
    additional: { college: '사범대', grade: '3', mbti: 'ENTJ', temperatureSensitivity: 'NORMAL' },
  },
  {
    id: '4',
    nickname: '올빼미',
    gender: 'M',
    dormitoryId: 'toegye',
    lifestyle: {
      smoker: 'YES',
      sleepHabit: 'SNORING',
      indoorEating: 'OK',
      bedtime: 'AFTER_02',
      wakeTime: 'AFTER_10',
      noiseSensitivity: 'LOW',
      cleanliness: 'LOW',
      relationshipStyle: 'CLOSE',
    },
    intro: '야행성이라 밤에 활동 많습니다. 이해해주실 분!',
    messageToRoommate: null,
    additional: { college: '경영대', grade: '2', mbti: null, temperatureSensitivity: 'HOT' },
  },
  {
    id: '5',
    nickname: '운동메이트',
    gender: 'M',
    dormitoryId: 'saerom',
    lifestyle: {
      smoker: 'NO',
      sleepHabit: 'NONE',
      indoorEating: 'OK',
      bedtime: '22_24',
      wakeTime: '06_08',
      noiseSensitivity: 'HIGH',
      cleanliness: 'MID',
      relationshipStyle: 'CLOSE',
    },
    intro: '같이 운동하거나 밥 먹을 룸메 찾습니다.',
    messageToRoommate: '수건 건조대 가져갈게요! 공용물품 같이 사요',
    additional: { college: '농업생명대', grade: '1', mbti: 'ENFP', temperatureSensitivity: 'COLD' },
  },
  {
    id: '6',
    nickname: '깔끔대장',
    gender: 'M',
    dormitoryId: 'saerom',
    lifestyle: {
      smoker: 'OK',
      sleepHabit: 'GRINDING',
      indoorEating: 'VENTILATE',
      bedtime: '24_02',
      wakeTime: '08_10',
      noiseSensitivity: 'MID',
      cleanliness: 'HIGH',
      relationshipStyle: 'CASUAL',
    },
    intro: '깔끔한 편이고 각자 생활 존중합니다.',
    messageToRoommate: null,
    additional: { college: null, grade: '4+', mbti: 'ISFJ', temperatureSensitivity: null },
  },
  {
    id: '7',
    nickname: '도서관지기',
    gender: 'M',
    dormitoryId: 'dasan',
    lifestyle: {
      smoker: 'NO',
      sleepHabit: 'NONE',
      indoorEating: 'NO',
      bedtime: '22_24',
      wakeTime: '06_08',
      noiseSensitivity: 'MID',
      cleanliness: 'HIGH',
      relationshipStyle: 'CASUAL',
    },
    intro: '도서관 자주 가고 방에선 조용히 지냅니다.',
    messageToRoommate: '샤워기 필터 제가 준비할게요',
    additional: { college: '인문대', grade: '2', mbti: 'INFJ', temperatureSensitivity: 'NORMAL' },
  },
  {
    id: '8',
    nickname: '학식러버',
    gender: 'M',
    dormitoryId: 'irum',
    lifestyle: {
      smoker: 'NO',
      sleepHabit: 'TALKING',
      indoorEating: 'OK',
      bedtime: '24_02',
      wakeTime: '08_10',
      noiseSensitivity: 'LOW',
      cleanliness: 'MID',
      relationshipStyle: 'CLOSE',
    },
    intro: '친하게 지내고 싶어요! 같이 학식 가실 분.',
    messageToRoommate: null,
    additional: { college: '자연과학대', grade: '1', mbti: null, temperatureSensitivity: null },
  },
];

export default function RoommateListTab({ user, onNavigate }: RoommateListTabProps) {
  const isUnassigned = !user.dormitoryId || user.dormitoryId === UNASSIGNED_ID;

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sortMode, setSortMode] = useState<SortMode>('match');
  const [selectedProfile, setSelectedProfile] = useState<RoommateProfile | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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
      <header className="bg-white border-b-2 border-[var(--knu-border)] px-5 py-4 sticky top-0 z-40">
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
      </header>

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
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-[var(--knu-background-alt)] rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-[var(--knu-text-tertiary)]" />
            </div>
            <p className="text-[var(--knu-text-secondary)] text-sm">
              {dormName
                ? `${dormName}에 아직 등록한 사용자가 없어요`
                : '조건에 맞는 사용자가 없어요. 필터를 조정해보세요'}
            </p>
          </div>
        ) : (
          filteredProfiles.map((profile) => (
            <UserCard
              key={profile.id}
              profile={profile}
              onClick={() => setSelectedProfile(profile)}
              onRequestMatch={() => {}}
              disabled={isUnassigned}
            />
          ))
        )}
      </div>

      {/* List End */}
      {filteredProfiles.length > 0 && (
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

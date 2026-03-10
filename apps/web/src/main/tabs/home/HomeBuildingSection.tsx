import { useState, useMemo } from 'react';
import { Building2, ChevronRight, AlertTriangle } from 'lucide-react';
import { Chip } from '@/components/Chip';
import { BuildingStatusSheet } from '../../components/BuildingStatusSheet';
import type { Dormitory } from '@/constants/dormitory';
import type { RoommateProfile } from '@/types/profile';
import type { BuildingStats } from './HomeTab';

interface HomeBuildingSectionProps {
  dormitory: Dormitory | null;
  buildingStats?: BuildingStats;
  profiles: Omit<RoommateProfile, 'matchScore'>[];
  onNavigateProfile: () => void;
  onNavigateList: () => void;
}

export function HomeBuildingSection({
  dormitory,
  buildingStats,
  profiles,
  onNavigateProfile,
  onNavigateList,
}: HomeBuildingSectionProps) {
  const [showBuildingStatus, setShowBuildingStatus] = useState(false);

  const buildingActiveUsers = buildingStats?.activeUsers ?? 0;
  const seasonPopularCondition = buildingStats?.popularCondition ?? '-';
  const todayNewUsers = buildingStats?.todayNewUsers ?? 0;
  const buildingMatchableUsers = buildingStats?.matchableUsers ?? 0;

  const buildingProfiles = useMemo(
    () => (dormitory ? profiles.filter((p) => p.dormitoryId === dormitory.id) : []),
    [profiles, dormitory],
  );

  return (
    <div>
      <h2 className="font-bold text-[var(--knu-text-primary)] mb-3">내 건물 현황</h2>
      {dormitory ? (
        <div className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[var(--knu-primary-light)] rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-[var(--knu-primary)]" />
              </div>
              <div>
                <h3 className="font-bold text-[var(--knu-text-primary)]">{dormitory.name}</h3>
                <div className="mt-1">
                  <Chip label={`${dormitory.roomType}인실`} variant="badge" />
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-[var(--knu-primary)]">
                {buildingActiveUsers}명
              </p>
              <p className="text-xs text-[var(--knu-text-tertiary)]">같은 건물 활동 중</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--knu-border)]">
            <p className="text-xs font-semibold text-[var(--knu-text-secondary)] mb-2">시즌 통계</p>
            <div className="space-y-1.5">
              <p className="text-xs text-[var(--knu-text-tertiary)]">
                <span className="font-medium text-[var(--knu-text-secondary)]">인기 조건:</span>{' '}
                {seasonPopularCondition}
              </p>
              <p className="text-xs text-[var(--knu-text-tertiary)]">
                <span className="font-medium text-[var(--knu-text-secondary)]">
                  오늘 신규 가입:
                </span>{' '}
                {todayNewUsers}명
              </p>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-[var(--knu-border)]">
            <button
              onClick={() => setShowBuildingStatus(true)}
              className="flex items-center gap-1 text-sm font-semibold text-[var(--knu-primary)]"
            >
              자세히 보기
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-orange-50 rounded-2xl border-2 border-orange-200 p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-orange-800 mb-1">건물이 아직 배정되지 않았어요</h3>
              <p className="text-xs text-orange-700 mb-3 leading-relaxed">
                건물이 배정되면 같은 건물 사용자를 확인하고 룸메이트 매칭을 받을 수 있어요.
              </p>
              <button
                onClick={onNavigateProfile}
                className="flex items-center gap-1 text-sm font-semibold text-orange-700"
              >
                배정 건물 등록하기
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {showBuildingStatus && dormitory && (
        <BuildingStatusSheet
          dormitoryName={dormitory.name}
          roomType={dormitory.roomType}
          activeUsers={buildingActiveUsers}
          matchableUsers={buildingMatchableUsers}
          todayNewUsers={todayNewUsers}
          profiles={buildingProfiles}
          onClose={() => setShowBuildingStatus(false)}
          onNavigateList={onNavigateList}
        />
      )}
    </div>
  );
}

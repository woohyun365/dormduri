'use client';

import { useState, useMemo } from 'react';
import { Building2, ChevronRight, AlertTriangle, Share2, Users } from 'lucide-react';
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

  const matchableUsers = buildingStats?.matchableUsers ?? 0;
  const activeUsers = buildingStats?.activeUsers ?? 0;

  const buildingProfiles = useMemo(
    () => (dormitory ? profiles.filter((p) => p.dormitoryId === dormitory.id) : []),
    [profiles, dormitory],
  );

  const genderCounts = useMemo(() => {
    const male = buildingProfiles.filter((p) => p.gender === 'M').length;
    const female = buildingProfiles.filter((p) => p.gender === 'F').length;
    return { male, female };
  }, [buildingProfiles]);

  const handleShare = async () => {
    const shareData = {
      title: 'KNU 룸메이트 매칭',
      text: '기숙사 룸메이트를 찾고 있다면? KNU 룸메이트 매칭 서비스를 이용해보세요!',
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // 사용자가 공유 취소
      }
    }
  };

  return (
    <div>
      <h2 className="font-bold text-[var(--knu-text-primary)] mb-3">내 건물 현황</h2>
      {dormitory ? (
        <div className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-4">
          {/* 건물 정보 + 매칭 가능 유저 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--knu-primary-light)] rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5 text-[var(--knu-primary)]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-[var(--knu-text-primary)]">{dormitory.name}</h3>
                  <Chip label={`${dormitory.roomType}인실`} variant="badge" />
                </div>
                <p className="text-xs text-[var(--knu-text-tertiary)] mt-0.5">
                  남 {genderCounts.male}명 · 여 {genderCounts.female}명
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-[var(--knu-primary)]">{matchableUsers}명</p>
              <p className="text-xs text-[var(--knu-text-tertiary)]">매칭 가능</p>
            </div>
          </div>

          {/* 0명 안내 + 공유 CTA (#102) */}
          {matchableUsers === 0 ? (
            <div className="mt-3 pt-3 border-t border-[var(--knu-border)]">
              <div className="bg-[var(--knu-background-alt)] rounded-xl p-3">
                <div className="flex items-start gap-2.5">
                  <Users className="w-4 h-4 text-[var(--knu-text-tertiary)] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-[var(--knu-text-secondary)] mb-2">
                      아직 같은 건물에 매칭 가능한 사용자가 없어요. 친구에게 서비스를 알려보세요!
                    </p>
                    <button
                      onClick={handleShare}
                      className="flex items-center gap-1.5 text-xs font-semibold text-[var(--knu-primary)]"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      친구에게 공유하기
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 pt-3 border-t border-[var(--knu-border)] flex items-center justify-between">
              <p className="text-xs text-[var(--knu-text-tertiary)]">전체 활동 {activeUsers}명</p>
              <button
                onClick={() => setShowBuildingStatus(true)}
                className="flex items-center gap-1 text-xs font-semibold text-[var(--knu-primary)]"
              >
                자세히 보기
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-orange-50 rounded-2xl border-2 border-orange-200 p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-orange-800 mb-1 text-sm">
                건물이 아직 배정되지 않았어요
              </h3>
              <p className="text-xs text-orange-700 mb-2 leading-relaxed">
                건물이 배정되면 같은 건물 사용자를 확인하고 매칭을 시작할 수 있어요.
              </p>
              <button
                onClick={onNavigateProfile}
                className="flex items-center gap-1 text-xs font-semibold text-orange-700"
              >
                배정 건물 등록하기
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {showBuildingStatus && dormitory && (
        <BuildingStatusSheet
          dormitoryName={dormitory.name}
          roomType={dormitory.roomType}
          activeUsers={activeUsers}
          matchableUsers={matchableUsers}
          todayNewUsers={buildingStats?.todayNewUsers ?? 0}
          profiles={buildingProfiles}
          onClose={() => setShowBuildingStatus(false)}
          onNavigateList={onNavigateList}
        />
      )}
    </div>
  );
}

import { isDormitoryAssigned } from '@/utils/dormitory';
import type { BuildingStats } from '../tabs/home/HomeTab';
import type { UserProfile, RoommateProfile } from '@/types/profile';

export function buildMainBuildingStats(
  user: UserProfile,
  profiles: Omit<RoommateProfile, 'matchScore'>[],
): BuildingStats {
  const hasBuilding = isDormitoryAssigned(user.dormitoryId);

  // 같은 건물 프로필 (profiles가 동일 건물 필터일 수 있으므로 dormitoryId 비교)
  const sameBuilding = hasBuilding
    ? profiles.filter((p) => p.dormitoryId === user.dormitoryId)
    : [];
  const sameBuildingGender = sameBuilding.filter((p) => p.gender === user.gender);

  // 인기 조건
  const nonSmokers = sameBuilding.filter((p) => p.lifestyle.smokingBehavior === 'NO').length;
  const earlyBed = sameBuilding.filter(
    (p) => p.lifestyle.bedtime === 'BEFORE_22' || p.lifestyle.bedtime === '22_24',
  ).length;
  const conditions: string[] = [];
  if (sameBuilding.length > 0) {
    if (nonSmokers > sameBuilding.length / 2) conditions.push('비흡연');
    if (earlyBed > sameBuilding.length / 2) conditions.push('24시 이전 취침');
  }

  return {
    // 고정 Mock — Sprint 7 BE에서 실제 전체 집계 API로 교체
    // profiles가 건물 필터링되어도 전체 통계는 항상 제공
    totalParticipants: 135,
    assignedParticipants: 120,
    todayNewTotal: 5,
    todayNewBuilding: hasBuilding ? 2 : 0,
    totalMatchSuccess: 8,
    buildingMatchSuccess: hasBuilding ? 3 : 0,
    // 프로필 기반 계산 (동일 건물)
    buildingMatchable: sameBuildingGender.length,
    buildingTotal: sameBuilding.length,
    popularCondition: conditions.length > 0 ? conditions.join(' + ') : '-',
  };
}

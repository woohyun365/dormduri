import { isDormitoryAssigned } from '@/utils/dormitory';
import type { BuildingStats, BuildingStatsSnapshot } from '../types/home';
import type { UserProfile, RoommateProfile } from '@/types/profile';

export function buildMainBuildingStats(
  user: UserProfile,
  profiles: Omit<RoommateProfile, 'matchScore'>[],
  summary: BuildingStatsSnapshot,
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
    totalParticipants: summary.totalParticipants,
    assignedParticipants: summary.assignedParticipants,
    todayNewTotal: summary.todayNewTotal,
    todayNewBuilding: hasBuilding ? summary.todayNewBuilding : 0,
    totalMatchSuccess: summary.totalMatchSuccess,
    buildingMatchSuccess: hasBuilding ? summary.buildingMatchSuccess : 0,
    // 프로필 기반 계산 (동일 건물)
    buildingMatchable: sameBuildingGender.length,
    buildingTotal: sameBuilding.length,
    popularCondition: conditions.length > 0 ? conditions.join(' + ') : '-',
  };
}

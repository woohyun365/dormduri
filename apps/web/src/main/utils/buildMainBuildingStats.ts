import { isDormitoryAssigned } from '@/utils/dormitory';
import type { BuildingStats } from '../tabs/home/HomeTab';
import type { UserProfile } from '@/types/profile';
import type { RoommateProfile } from '@/types/profile';

export function buildMainBuildingStats(
  user: UserProfile,
  profiles: Omit<RoommateProfile, 'matchScore'>[],
): BuildingStats | undefined {
  if (!isDormitoryAssigned(user.dormitoryId)) return undefined;

  const sameBuilding = profiles.filter((p) => p.dormitoryId === user.dormitoryId);
  const nonSmokers = sameBuilding.filter((p) => p.lifestyle.smokingBehavior === 'NO').length;
  const earlyBed = sameBuilding.filter(
    (p) => p.lifestyle.bedtime === 'BEFORE_22' || p.lifestyle.bedtime === '22_24',
  ).length;

  const conditions: string[] = [];
  if (nonSmokers > sameBuilding.length / 2) conditions.push('비흡연');
  if (earlyBed > sameBuilding.length / 2) conditions.push('24시 이전 취침');

  return {
    activeUsers: sameBuilding.length,
    matchableUsers: sameBuilding.filter((p) => p.gender === user.gender).length,
    todayNewUsers: 0,
    popularCondition: conditions.length > 0 ? conditions.join(' + ') : '-',
  };
}

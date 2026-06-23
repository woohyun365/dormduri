import type { HomeDashboardResponse, HomeDashboardStats } from '@repo/shared/home';
import type { Season } from '@/constants/season';
import type { SeasonState } from '@/types/season';
import type { BuildingStats } from '@/main/types/home';
import type { ActiveMatch } from '@/types/match';

interface LegacySeasonContext {
  season: Season;
  state: SeasonState;
  isOpen: boolean;
  isMatching: boolean;
  daysUntilEnd: number;
}

export function toLegacyBuildingStats(stats: HomeDashboardStats): BuildingStats {
  return {
    totalParticipants: stats.totalParticipants,
    assignedParticipants: stats.assignedParticipants,
    buildingMatchable: stats.buildingMatchable,
    buildingTotal: stats.buildingTotal,
    todayNewTotal: stats.todayNewTotal,
    todayNewBuilding: stats.todayNewBuilding,
    totalMatchSuccess: stats.totalMatchSuccess,
    buildingMatchSuccess: stats.buildingMatchSuccess,
    popularCondition: '-',
  };
}

export function toLegacySeasonContext(
  dashboard: HomeDashboardResponse | null,
  fallback: LegacySeasonContext,
): LegacySeasonContext {
  if (!dashboard?.season.hasCurrentSeason || !dashboard.season.state) {
    return fallback;
  }

  return {
    season: {
      name: dashboard.season.summary?.name ?? fallback.season.name,
      roomSelectionDate:
        dashboard.season.schedule?.matchingEnd ?? fallback.season.roomSelectionDate,
    },
    state: dashboard.season.state,
    isOpen: dashboard.season.isOpen,
    isMatching: dashboard.season.isMatching,
    daysUntilEnd: dashboard.season.daysUntilMatchingEnd ?? fallback.daysUntilEnd,
  };
}

export function hasUpcomingSeasonWindow(dashboard: HomeDashboardResponse): boolean {
  return dashboard.season.hasCurrentSeason && dashboard.season.schedule !== null;
}

export function toLegacyActiveMatch(dashboard: HomeDashboardResponse): ActiveMatch | null {
  const activeMatch = dashboard.matching.activeMatch ?? dashboard.viewer.match.activeMatch;
  if (!activeMatch) {
    return null;
  }

  const requestedByViewerAt = activeMatch.unmatchProgress.requestedByViewerAt;
  const requestedByCounterpartAt = activeMatch.unmatchProgress.requestedByCounterpartAt;

  return {
    matchId: activeMatch.id,
    partnerUserId: activeMatch.counterpartUserId,
    partnerNickname: activeMatch.counterpartNickname ?? '상대',
    partnerDormitoryId: null,
    matchScore: activeMatch.matchScore ?? 0,
    scoreType: activeMatch.matchScore == null ? 'gated' : 'full',
    matchedAt: activeMatch.startedAt,
    cancelRequestedAt: requestedByViewerAt ?? requestedByCounterpartAt,
    cancelRequestedBy: requestedByViewerAt
      ? 'self'
      : requestedByCounterpartAt
        ? 'counterpart'
        : null,
    kind: 'pair',
    groupRole: null,
    groupStage: null,
    groupCapacity: 2,
    groupMemberCount: 2,
  };
}

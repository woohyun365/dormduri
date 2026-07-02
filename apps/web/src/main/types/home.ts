export interface BuildingStatsSnapshot {
  totalParticipants: number;
  assignedParticipants: number;
  todayNewTotal: number;
  todayNewBuilding: number;
  totalMatchSuccess: number;
  buildingMatchSuccess: number;
  todayMatchSuccessTotal: number;
  todayMatchSuccessBuilding: number;
}

export type PastSeasonPreset = 'none' | 'failed' | 'matched';

export interface HomeDashboardState {
  buildingStats: BuildingStatsSnapshot;
  pastSeason: PastSeasonPreset;
  nextSeasonRegistered: boolean;
  unreadMessages: number;
}

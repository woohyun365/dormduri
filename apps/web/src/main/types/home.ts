export interface BuildingStats {
  totalParticipants: number;
  assignedParticipants: number;
  buildingMatchable: number;
  buildingTotal: number;
  todayNewTotal: number;
  todayNewBuilding: number;
  totalMatchSuccess: number;
  buildingMatchSuccess: number;
  popularCondition: string;
}

export interface PastSeasonResult {
  matched: boolean;
  partnerName?: string;
  totalRequests: number;
  sentRequests: number;
  totalChats: number;
}

export interface BuildingStatsSnapshot {
  totalParticipants: number;
  assignedParticipants: number;
  todayNewTotal: number;
  todayNewBuilding: number;
  totalMatchSuccess: number;
  buildingMatchSuccess: number;
}

export type PastSeasonPreset = 'none' | 'failed' | 'matched';

export interface HomeDashboardState {
  buildingStats: BuildingStatsSnapshot;
  pastSeason: PastSeasonPreset;
  nextSeasonRegistered: boolean;
  unreadMessages: number;
}

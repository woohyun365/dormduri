import {
  CAMPUS_NAMES,
  getDormitoryById,
  isCampusOperated as isCampusOperatedFn,
} from '@/constants/dormitory';
import { calcSeasonDates, type Season } from '@/constants/season';
import { isDormitoryAssigned } from '@/utils/dormitory';
import { calcDaysUntilTimestamp, formatDateDot } from '@/utils/date';
import { isLifestyleRequiredComplete } from '@/utils/lifestyle';
import type { SeasonContextValue } from '@/contexts/SeasonContext';
import type { ActiveMatch } from '@/types/match';
import type { UserProfile } from '@/types/profile';
import type { SeasonState } from '@/types/season';
import type { HomeDashboardResponse, HomeDashboardStats } from '@repo/shared/home';
import type { MatchingSummaryActiveMatch, MatchingSummaryStatus } from '../HomeMatchingSummary';
import type { TipSeasonStatus } from '../DynamicTipBanner';

export interface HomeMatchingSummaryOverrides {
  sentRequests?: number | null;
  receivedRequests?: number | null;
  activeChats?: number | null;
}

export interface HomeDashboardScheduleViewModel {
  matchStartFormatted: string;
  openStartFormatted: string;
  daysUntilMatchStart: number;
  daysUntilOpenStart: number;
  hasUpcomingSeasonWindow: boolean;
  profileCompletion: number;
}

export interface HomeDashboardStatsBarViewModel {
  totalCount: number;
  buildingCount: number;
  todayNewTotal: number;
  todayNewBuilding: number;
  matchSuccessCount: number;
  urgency: 'normal' | 'warning' | 'critical';
}

export interface HomeDashboardMatchingSummaryViewModel {
  status: MatchingSummaryStatus;
  stats: {
    sentRequests: number;
    receivedRequests: number;
    activeChats: number;
    expiringCount: number;
  };
  activeMatch?: MatchingSummaryActiveMatch;
  receivedRequesters: string[];
  gatingReason: 'no_building' | null;
}

export interface HomeDashboardPreparationViewModel {
  daysUntilStart: number;
  seasonStartDate: string;
  profileCompletion: number;
  hasBuilding: boolean;
  canSelectBuilding: boolean;
  hasLifestylePattern: boolean;
  missingFields: string[];
}

export interface HomeDashboardSeasonSummaryViewModel {
  pastSeasonName: string;
  daysUntilNext: number;
  nextSeasonDate: string;
  nextSeasonName: string;
}

export interface HomeDashboardTipViewModel {
  seasonStatus: TipSeasonStatus;
  receivedRequests: number;
  sentRequests: number;
  activeChats: number;
  unreadMessages: number;
}

export interface HomeDashboardViewModel {
  hasCurrentSeason: boolean;
  isCampusOperated: boolean;
  campusName: string;
  isUnassigned: boolean;
  dormitory: NonNullable<ReturnType<typeof getDormitoryById>> | null;
  hasActiveMatch: boolean;
  activeMatch: ActiveMatch | null;
  statsBar: HomeDashboardStatsBarViewModel;
  matchingSummary: HomeDashboardMatchingSummaryViewModel;
  preparation: HomeDashboardPreparationViewModel;
  seasonSummary: HomeDashboardSeasonSummaryViewModel;
  tip: HomeDashboardTipViewModel;
  capabilities: {
    canStartChat: boolean;
    canViewMatchHistory: boolean;
    canSelectDormitory: boolean;
    canEnterRoommateSearch: boolean;
  };
}

interface BuildHomeDashboardViewModelInput {
  dashboard: HomeDashboardResponse;
  user: UserProfile;
  season: Season;
  seasonState: SeasonState;
  daysUntilEnd: number;
  renderedAt: number;
  matchingOverrides?: HomeMatchingSummaryOverrides;
}

interface SeasonContextFallback {
  season: Season;
  state: SeasonState;
  isOpen: boolean;
  isMatching: boolean;
  daysUntilEnd: number;
}

const HOME_OPTIONAL_FIELD_LABELS = [
  ['messageToRoommate', '룸메에게 한마디'],
  ['college', '단대'],
  ['grade', '학년'],
  ['mbti', 'MBTI'],
  ['birthYear', '출생연도'],
] as const;

const MS_48_HOURS = 48 * 60 * 60 * 1000;

export function toHomeSeasonContext(
  dashboard: HomeDashboardResponse | null,
  fallback: SeasonContextFallback,
): SeasonContextValue {
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
    daysUntilEnd:
      dashboard.season.daysUntilMatchingEnd ??
      dashboard.season.daysUntilSeasonEnd ??
      fallback.daysUntilEnd,
  };
}

export function toHomeActiveMatch(dashboard: HomeDashboardResponse): ActiveMatch | null {
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

export function hasHomeUpcomingSeasonWindow(dashboard: HomeDashboardResponse): boolean {
  return dashboard.season.hasCurrentSeason && dashboard.season.schedule !== null;
}

export function getHomeMissingOptionalFields(user: UserProfile): string[] {
  const fields: string[] = [];
  if (!user.messageToRoommate) fields.push('룸메에게 한마디');
  if (!user.additional.college) fields.push('단대');
  if (!user.additional.grade) fields.push('학년');
  if (!user.additional.mbti) fields.push('MBTI');
  if (!user.additional.birthYear) fields.push('출생연도');
  return fields;
}

export function buildHomeDashboardViewModel({
  dashboard,
  user,
  season,
  seasonState,
  daysUntilEnd,
  renderedAt,
  matchingOverrides,
}: BuildHomeDashboardViewModelInput): HomeDashboardViewModel {
  const isCampusOperated = dashboard.viewer.campusOperated && isCampusOperatedFn(user.campus);
  const selectedDormitoryId = dashboard.viewer.selection.dormitoryId;
  const hasDashboardAssignedDormitory =
    (dashboard.viewer.selection.state === 'SELECTED' ||
      dashboard.viewer.selection.state === 'ASSIGNED') &&
    isDormitoryAssigned(selectedDormitoryId);
  const isUnassigned = !hasDashboardAssignedDormitory;
  const dormitory = hasDashboardAssignedDormitory
    ? (getDormitoryById(selectedDormitoryId) ?? null)
    : null;
  const activeMatch = toHomeActiveMatch(dashboard);
  const missingFields = getHomeMissingOptionalFields(user);
  const optionalCompleted = HOME_OPTIONAL_FIELD_LABELS.length - missingFields.length;
  const hasLifestyle = isLifestyleRequiredComplete(user.lifestyle);
  const schedule = buildScheduleViewModel({
    dashboard,
    season,
    renderedAt,
    hasLifestyle,
    hasBuilding: dormitory !== null,
    optionalCompleted,
  });
  const matchingSummary = buildMatchingSummaryViewModel({
    dashboard,
    seasonState,
    isCampusOperated,
    isUnassigned,
    activeMatch,
    renderedAt,
    matchingOverrides,
  });

  return {
    hasCurrentSeason: dashboard.season.hasCurrentSeason,
    isCampusOperated,
    campusName: CAMPUS_NAMES[user.campus],
    isUnassigned,
    dormitory,
    hasActiveMatch: activeMatch !== null,
    activeMatch,
    statsBar: buildStatsBarViewModel({
      stats: dashboard.stats,
      seasonState,
      daysUntilEnd,
    }),
    matchingSummary,
    preparation: {
      daysUntilStart: schedule.daysUntilMatchStart,
      seasonStartDate: schedule.matchStartFormatted,
      profileCompletion: schedule.profileCompletion,
      hasBuilding: dormitory !== null,
      canSelectBuilding: dashboard.viewer.capabilities.canSelectDormitory,
      hasLifestylePattern: hasLifestyle,
      missingFields,
    },
    seasonSummary: buildSeasonSummaryViewModel({
      season,
      schedule,
    }),
    tip: {
      seasonStatus: buildTipSeasonStatus({
        seasonState,
        isCampusOperated,
        isUnassigned,
        hasActiveMatch: activeMatch !== null,
      }),
      receivedRequests: matchingSummary.stats.receivedRequests,
      sentRequests: matchingSummary.stats.sentRequests,
      activeChats: matchingSummary.stats.activeChats,
      unreadMessages: dashboard.matching.unreadMessageCount,
    },
    capabilities: {
      canStartChat: dashboard.viewer.capabilities.canStartChat,
      canViewMatchHistory: dashboard.viewer.capabilities.canViewMatchHistory,
      canSelectDormitory: dashboard.viewer.capabilities.canSelectDormitory,
      canEnterRoommateSearch: dashboard.viewer.capabilities.canEnterRoommateSearch,
    },
  };
}

function buildScheduleViewModel({
  dashboard,
  season,
  renderedAt,
  hasLifestyle,
  hasBuilding,
  optionalCompleted,
}: {
  dashboard: HomeDashboardResponse;
  season: Season;
  renderedAt: number;
  hasLifestyle: boolean;
  hasBuilding: boolean;
  optionalCompleted: number;
}): HomeDashboardScheduleViewModel {
  const fallbackDates = calcSeasonDates(season.roomSelectionDate);
  const openStart = dashboard.season.schedule?.preparationStart ?? fallbackDates.openStart;
  const matchStart = dashboard.season.schedule?.matchingStart ?? fallbackDates.matchStart;
  const openStartTs = new Date(`${openStart}T00:00:00+09:00`).getTime();
  const matchStartTs = new Date(`${matchStart}T00:00:00+09:00`).getTime();
  const lifestyleScore = hasLifestyle ? 40 : 0;
  const buildingScore = hasBuilding ? 30 : 0;
  const optionalScore = (optionalCompleted / HOME_OPTIONAL_FIELD_LABELS.length) * 30;

  return {
    matchStartFormatted: formatDateDot(matchStart),
    openStartFormatted: formatDateDot(openStart),
    daysUntilMatchStart: calcDaysUntilTimestamp(matchStartTs, renderedAt),
    daysUntilOpenStart: calcDaysUntilTimestamp(openStartTs, renderedAt),
    hasUpcomingSeasonWindow: hasHomeUpcomingSeasonWindow(dashboard),
    profileCompletion: Math.round(lifestyleScore + buildingScore + optionalScore),
  };
}

function buildStatsBarViewModel({
  stats,
  seasonState,
  daysUntilEnd,
}: {
  stats: HomeDashboardStats;
  seasonState: SeasonState;
  daysUntilEnd: number;
}): HomeDashboardStatsBarViewModel {
  return {
    totalCount: seasonState === 'OFF_SEASON' ? stats.totalParticipants : stats.assignedParticipants,
    buildingCount:
      seasonState === 'SEASON_MATCHING' ? stats.buildingMatchable : stats.buildingTotal,
    todayNewTotal: seasonState === 'OFF_SEASON' ? 0 : stats.todayNewTotal,
    todayNewBuilding: seasonState === 'OFF_SEASON' ? 0 : stats.todayNewBuilding,
    matchSuccessCount:
      seasonState === 'SEASON_MATCHING'
        ? stats.buildingMatchSuccess || stats.totalMatchSuccess
        : seasonState === 'OFF_SEASON' || seasonState === 'SEASON_POST_MATCH'
          ? stats.totalMatchSuccess
          : 0,
    urgency:
      seasonState === 'SEASON_MATCHING'
        ? daysUntilEnd <= 3
          ? 'critical'
          : daysUntilEnd <= 7
            ? 'warning'
            : 'normal'
        : 'normal',
  };
}

function buildMatchingSummaryViewModel({
  dashboard,
  seasonState,
  isCampusOperated,
  isUnassigned,
  activeMatch,
  renderedAt,
  matchingOverrides,
}: {
  dashboard: HomeDashboardResponse;
  seasonState: SeasonState;
  isCampusOperated: boolean;
  isUnassigned: boolean;
  activeMatch: ActiveMatch | null;
  renderedAt: number;
  matchingOverrides?: HomeMatchingSummaryOverrides;
}): HomeDashboardMatchingSummaryViewModel {
  const receivedPending = dashboard.matching.recentReceivedRequests;
  const expiringCount = receivedPending.filter((request) => {
    const remaining = new Date(request.expiresAt).getTime() - renderedAt;
    return remaining > 0 && remaining <= MS_48_HOURS;
  }).length;
  const receivedRequesters = receivedPending
    .map((request) => request.counterpartSummary.profileSummary.nickname)
    .filter((nickname): nickname is string => nickname.length > 0);
  const sentRequests = matchingOverrides?.sentRequests ?? dashboard.matching.pendingSentCount;
  const receivedRequests =
    matchingOverrides?.receivedRequests ?? dashboard.matching.pendingReceivedCount;
  const activeChats = matchingOverrides?.activeChats ?? 0;

  let status: MatchingSummaryStatus;
  if (!isCampusOperated) status = 'NOT_OPERATED';
  else if (seasonState === 'OFF_SEASON') status = 'OFF_SEASON';
  else if (seasonState === 'SEASON_OPEN') status = 'SEASON_OPEN';
  else if (activeMatch) status = 'ACTIVE_MATCH';
  else if (receivedRequests > 0 || sentRequests > 0 || activeChats > 0) status = 'HAS_ACTIVITY';
  else status = 'NO_ACTIVITY';

  return {
    status,
    stats: {
      sentRequests,
      receivedRequests,
      activeChats,
      expiringCount,
    },
    activeMatch: activeMatch
      ? {
          nickname: activeMatch.partnerNickname,
          matchScore: activeMatch.matchScore,
          groupStage: activeMatch.groupStage,
          groupMemberCount: activeMatch.groupMemberCount,
          groupCapacity: activeMatch.groupCapacity,
        }
      : undefined,
    receivedRequesters,
    gatingReason:
      isCampusOperated && seasonState === 'SEASON_MATCHING' && isUnassigned ? 'no_building' : null,
  };
}

function buildTipSeasonStatus({
  seasonState,
  isCampusOperated,
  isUnassigned,
  hasActiveMatch,
}: {
  seasonState: SeasonState;
  isCampusOperated: boolean;
  isUnassigned: boolean;
  hasActiveMatch: boolean;
}): TipSeasonStatus {
  if (!isCampusOperated) return 'NOT_OPERATED';
  if (hasActiveMatch) return 'ACTIVE_MATCH';
  if (seasonState === 'OFF_SEASON') return 'OFF_SEASON';
  if (seasonState === 'SEASON_OPEN') return 'SEASON_OPEN';
  if (isUnassigned) return 'SEASON_MATCHING_NO_BUILDING';
  return 'SEASON_MATCHING';
}

function buildSeasonSummaryViewModel({
  season,
  schedule,
}: {
  season: Season;
  schedule: HomeDashboardScheduleViewModel;
}): HomeDashboardSeasonSummaryViewModel {
  return {
    pastSeasonName: season.name,
    daysUntilNext: schedule.hasUpcomingSeasonWindow ? schedule.daysUntilOpenStart : 0,
    nextSeasonDate: schedule.hasUpcomingSeasonWindow ? schedule.openStartFormatted : '',
    nextSeasonName: schedule.hasUpcomingSeasonWindow ? getNextSeasonName(season.name) : '',
  };
}

function getNextSeasonName(currentName: string): string {
  const firstSemester = currentName.match(/^(\d{4})년\s*1학기$/);
  if (firstSemester) return `${firstSemester[1]}년 2학기`;

  const secondSemester = currentName.match(/^(\d{4})년\s*2학기$/);
  if (secondSemester) return `${Number(secondSemester[1]) + 1}년 1학기`;

  return currentName ? `${currentName} 다음 시즌` : '다음 시즌';
}

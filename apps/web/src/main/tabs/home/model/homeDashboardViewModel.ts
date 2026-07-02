import {
  CAMPUS_NAMES,
  getDormitoryById,
  isCampusOperated as isCampusOperatedFn,
} from '@/constants/dormitory';
import { isDormitoryAssigned } from '@/utils/dormitory';
import {
  calcDaysUntilTimestamp,
  formatDateDot,
  formatDateMonthDayDot,
} from '@/main/tabs/home/model/homeDateDisplay';
import type { ActiveMatch } from '@/types/match';
import type { SeasonState } from '@repo/shared/season/runtime';
import type { HomeDashboardResponse, HomeDashboardStats } from '@repo/shared/home';
import type {
  MatchingSummaryActiveMatch,
  MatchingSummaryStatus,
} from '../components/HomeMatchingSummary';
import type { TipSeasonStatus } from '../components/DynamicTipBanner';

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
  todayMatchSuccessCount: number;
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
  gatingReason: 'registration_required' | null;
}

export interface HomeDashboardPreparationViewModel {
  daysUntilStart: number;
  seasonStartDate: string;
  profileCompletion: number;
  hasBuilding: boolean;
  canSelectBuilding: boolean;
  hasSeasonProfile: boolean;
  registrationReady: boolean;
  registrationUnavailableReasons: HomeDashboardResponse['viewer']['seasonProfile']['completion']['registrationUnavailableReasons'];
}

export interface HomeDashboardSeasonSummaryViewModel {
  pastSeasonName: string;
  lastSeason: HomeDashboardResponse['seasonHistorySummary']['lastSeason'];
  daysUntilNext: number;
  nextSeasonDate: string;
  nextSeasonName: string;
  hasNextSeasonPreview: boolean;
}

export interface HomeDashboardOperatedDormitoryViewModel {
  id: string;
  name: string;
  roomSelectionDate: string;
  roomSelectionDateRaw: string;
}

export interface HomeDashboardTipViewModel {
  seasonStatus: TipSeasonStatus;
  receivedRequests: number;
  sentRequests: number;
  activeChats: number;
  unreadMessages: number;
}

export interface HomeDashboardMatchingWindowViewModel {
  matchingStartDate: string;
  matchingStartDateShort: string;
  roomSelectionDate: string;
  roomSelectionDateShort: string;
  roomSelectionDormitoryName: string;
  daysUntilRoomSelection: number;
  progressPercent: number;
}

export interface HomeDashboardViewerIdentityViewModel {
  userId: string;
  nickname: string;
  avatarInitial: string;
  gender: HomeDashboardResponse['viewer']['identity']['user']['gender'];
  genderLabel: string;
  campus: HomeDashboardResponse['viewer']['identity']['user']['campus'];
  campusName: string;
}

export interface HomeDashboardViewModel {
  hasCurrentSeason: boolean;
  seasonState: SeasonState;
  daysUntilEnd: number;
  isSeasonOpen: boolean;
  isSeasonMatching: boolean;
  isCampusOperated: boolean;
  campusName: string;
  viewerIdentity: HomeDashboardViewerIdentityViewModel;
  isUnassigned: boolean;
  dormitory: NonNullable<ReturnType<typeof getDormitoryById>> | null;
  hasActiveMatch: boolean;
  activeMatch: ActiveMatch | null;
  statsBar: HomeDashboardStatsBarViewModel;
  matchingSummary: HomeDashboardMatchingSummaryViewModel;
  preparation: HomeDashboardPreparationViewModel;
  seasonSummary: HomeDashboardSeasonSummaryViewModel;
  operatedDormitories: HomeDashboardOperatedDormitoryViewModel[];
  matchingWindow: HomeDashboardMatchingWindowViewModel | null;
  tip: HomeDashboardTipViewModel;
  capabilities: {
    canRequestMatch: boolean;
    canStartChat: boolean;
    canViewMatchHistory: boolean;
    canSelectDormitory: boolean;
    canEnterRoommateSearch: boolean;
  };
}

interface BuildHomeDashboardViewModelInput {
  dashboard: HomeDashboardResponse;
  renderedAt: number;
}

const MS_48_HOURS = 48 * 60 * 60 * 1000;

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

export function buildHomeDashboardViewModel({
  dashboard,
  renderedAt,
}: BuildHomeDashboardViewModelInput): HomeDashboardViewModel {
  const seasonState = dashboard.season.state ?? 'OFF_SEASON';
  const daysUntilEnd =
    dashboard.season.daysUntilMatchingEnd ?? dashboard.season.daysUntilSeasonEnd ?? 0;
  const viewerIdentity = buildHomeViewerIdentityViewModel(dashboard);
  const isCampusOperated =
    dashboard.viewer.campusOperated && isCampusOperatedFn(viewerIdentity.campus);
  const selectedDormitoryId = dashboard.viewer.selection.dormitoryId;
  const hasDashboardAssignedDormitory =
    (dashboard.viewer.selection.state === 'SELECTED' ||
      dashboard.viewer.selection.state === 'ASSIGNED') &&
    isDormitoryAssigned(selectedDormitoryId);
  const isUnassigned = !hasDashboardAssignedDormitory;
  const dormitory = hasDashboardAssignedDormitory
    ? (getDormitoryById(selectedDormitoryId) ?? null)
    : null;
  const rawActiveMatch = dashboard.matching.activeMatch ?? dashboard.viewer.match.activeMatch;
  const activeMatch = toHomeActiveMatch(dashboard);
  const seasonProfile = dashboard.viewer.seasonProfile;
  const hasSeasonProfile =
    seasonProfile.registered || !seasonProfile.completion.profileCompletionRequired;
  const hasBuilding = !seasonProfile.completion.dormitorySelectionRequired;
  const registrationReady = seasonProfile.registered;
  const profileCompletion = buildSeasonProfileCompletion({ seasonProfile });
  const schedule = buildScheduleViewModel({
    dashboard,
    renderedAt,
    profileCompletion,
  });
  const matchingSummary = buildMatchingSummaryViewModel({
    dashboard,
    seasonState,
    isCampusOperated,
    registrationReady,
    activeMatch,
    rawActiveMatch,
    renderedAt,
  });
  const operatedDormitories = buildOperatedDormitoryViewModel(dashboard);
  const matchingWindow = buildMatchingWindowViewModel({
    dashboard,
    dormitoryName: dormitory?.name ?? null,
    selectedDormitoryId,
    renderedAt,
  });

  return {
    hasCurrentSeason: dashboard.season.hasCurrentSeason,
    seasonState,
    daysUntilEnd,
    isSeasonOpen: dashboard.season.isOpen,
    isSeasonMatching: dashboard.season.isMatching,
    isCampusOperated,
    campusName: viewerIdentity.campusName,
    viewerIdentity,
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
      hasBuilding,
      canSelectBuilding:
        dashboard.viewer.capabilities.canSelectDormitory || seasonProfile.canSelectDormitory,
      hasSeasonProfile,
      registrationReady,
      registrationUnavailableReasons: seasonProfile.completion.registrationUnavailableReasons,
    },
    seasonSummary: buildSeasonSummaryViewModel({
      dashboard,
      schedule,
      renderedAt,
    }),
    operatedDormitories,
    matchingWindow,
    tip: {
      seasonStatus: buildTipSeasonStatus({
        seasonState,
        isCampusOperated,
        registrationReady,
        hasActiveMatch: activeMatch !== null,
      }),
      receivedRequests: matchingSummary.stats.receivedRequests,
      sentRequests: matchingSummary.stats.sentRequests,
      activeChats: matchingSummary.stats.activeChats,
      unreadMessages: dashboard.matching.unreadMessageCount,
    },
    capabilities: {
      canRequestMatch: dashboard.viewer.capabilities.canRequestMatch,
      canStartChat: dashboard.viewer.capabilities.canStartChat,
      canViewMatchHistory: dashboard.viewer.capabilities.canViewMatchHistory,
      canSelectDormitory: dashboard.viewer.capabilities.canSelectDormitory,
      canEnterRoommateSearch: dashboard.viewer.capabilities.canEnterRoommateSearch,
    },
  };
}

function buildHomeViewerIdentityViewModel(
  dashboard: HomeDashboardResponse,
): HomeDashboardViewerIdentityViewModel {
  const user = dashboard.viewer.identity.user;
  const nickname = dashboard.viewer.identity.displayIdentity.nickname || user.nickname;

  return {
    userId: user.id,
    nickname,
    avatarInitial: nickname.charAt(0) || '룸',
    gender: user.gender,
    genderLabel: user.gender === 'M' ? '남' : '여',
    campus: user.campus,
    campusName: CAMPUS_NAMES[user.campus],
  };
}

function buildSeasonProfileCompletion({
  seasonProfile,
}: {
  seasonProfile: HomeDashboardResponse['viewer']['seasonProfile'];
}): number {
  if (!seasonProfile.hasCurrentSeason) return 0;
  if (seasonProfile.registered) return 100;

  const profileScore = seasonProfile.completion.profileCompletionRequired ? 0 : 50;
  const buildingScore = seasonProfile.completion.dormitorySelectionRequired ? 0 : 30;
  const registrationScore = seasonProfile.completion.registrationUnavailable ? 0 : 20;

  return profileScore + buildingScore + registrationScore;
}

function buildScheduleViewModel({
  dashboard,
  renderedAt,
  profileCompletion,
}: {
  dashboard: HomeDashboardResponse;
  renderedAt: number;
  profileCompletion: number;
}): HomeDashboardScheduleViewModel {
  const openStart =
    dashboard.season.schedule?.preparationStart ??
    (dashboard.nextSeasonPreview?.visibleToUser
      ? dashboard.nextSeasonPreview.preparationStartDate
      : null);
  const matchStart =
    dashboard.season.schedule?.matchingStart ??
    (dashboard.nextSeasonPreview?.visibleToUser
      ? dashboard.nextSeasonPreview.matchingStartDate
      : null);
  const openStartTs = openStart ? new Date(`${openStart}T00:00:00+09:00`).getTime() : null;
  const matchStartTs = matchStart ? new Date(`${matchStart}T00:00:00+09:00`).getTime() : null;

  return {
    matchStartFormatted: matchStart ? formatDateDot(matchStart) : '',
    openStartFormatted: openStart ? formatDateDot(openStart) : '',
    daysUntilMatchStart:
      matchStartTs === null ? 0 : calcDaysUntilTimestamp(matchStartTs, renderedAt),
    daysUntilOpenStart: openStartTs === null ? 0 : calcDaysUntilTimestamp(openStartTs, renderedAt),
    hasUpcomingSeasonWindow: hasHomeUpcomingSeasonWindow(dashboard),
    profileCompletion,
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
    todayMatchSuccessCount:
      seasonState === 'SEASON_MATCHING'
        ? stats.todayMatchSuccessBuilding || stats.todayMatchSuccessTotal
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
  registrationReady,
  activeMatch,
  rawActiveMatch,
  renderedAt,
}: {
  dashboard: HomeDashboardResponse;
  seasonState: SeasonState;
  isCampusOperated: boolean;
  registrationReady: boolean;
  activeMatch: ActiveMatch | null;
  rawActiveMatch: HomeDashboardResponse['matching']['activeMatch'];
  renderedAt: number;
}): HomeDashboardMatchingSummaryViewModel {
  const receivedPending = dashboard.matching.recentReceivedRequests;
  const expiringCount = receivedPending.filter((request) => {
    const remaining = new Date(request.expiresAt).getTime() - renderedAt;
    return remaining > 0 && remaining <= MS_48_HOURS;
  }).length;
  const receivedRequesters = receivedPending
    .map((request) => request.counterpartSummary.profileSummary.nickname)
    .filter((nickname): nickname is string => nickname.length > 0);
  const sentRequests = dashboard.matching.pendingSentCount;
  const receivedRequests = dashboard.matching.pendingReceivedCount;
  const activeChats = dashboard.matching.activeChatThreadCount;

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
          id: rawActiveMatch?.id ?? activeMatch.matchId,
          counterpartUserId: rawActiveMatch?.counterpartUserId ?? activeMatch.partnerUserId,
          counterpartParticipantId: rawActiveMatch?.counterpartParticipantId ?? '',
          nickname:
            rawActiveMatch?.counterpartSummary?.profileSummary.nickname ??
            rawActiveMatch?.counterpartNickname ??
            activeMatch.partnerNickname,
          matchScore: rawActiveMatch?.matchScore ?? activeMatch.matchScore,
          matchedAt: rawActiveMatch?.startedAt ?? activeMatch.matchedAt,
          unmatchProgress: rawActiveMatch?.unmatchProgress ?? {
            state: 'NONE',
            requestedByViewerAt: null,
            requestedByCounterpartAt: null,
            progressCount: 0,
            requiredCount: 2,
            canRequest: false,
            canCancel: false,
            availableUntil: null,
          },
          ...(rawActiveMatch?.counterpartSummary
            ? { counterpartSummary: rawActiveMatch.counterpartSummary }
            : {}),
          groupStage: activeMatch.groupStage,
          groupMemberCount: activeMatch.groupMemberCount,
          groupCapacity: activeMatch.groupCapacity,
        }
      : undefined,
    receivedRequesters,
    gatingReason:
      isCampusOperated &&
      seasonState === 'SEASON_MATCHING' &&
      !registrationReady &&
      activeMatch === null
        ? 'registration_required'
        : null,
  };
}

function buildTipSeasonStatus({
  seasonState,
  isCampusOperated,
  registrationReady,
  hasActiveMatch,
}: {
  seasonState: SeasonState;
  isCampusOperated: boolean;
  registrationReady: boolean;
  hasActiveMatch: boolean;
}): TipSeasonStatus {
  if (!isCampusOperated) return 'NOT_OPERATED';
  if (hasActiveMatch) return 'ACTIVE_MATCH';
  if (seasonState === 'OFF_SEASON') return 'OFF_SEASON';
  if (seasonState === 'SEASON_OPEN') return 'SEASON_OPEN';
  if (!registrationReady) return 'SEASON_MATCHING_REGISTRATION_REQUIRED';
  return 'SEASON_MATCHING';
}

function buildOperatedDormitoryViewModel(
  dashboard: HomeDashboardResponse,
): HomeDashboardOperatedDormitoryViewModel[] {
  const preview = dashboard.nextSeasonPreview?.visibleToUser ? dashboard.nextSeasonPreview : null;
  const operations = dashboard.season.hasCurrentSeason
    ? dashboard.season.operatedDormitories
    : (preview?.operatedDormitories ?? []);

  return operations
    .filter((operation) => operation.isOperated)
    .map((operation) => {
      const dormitory = getDormitoryById(operation.dormitoryId);

      return {
        id: operation.dormitoryId,
        name: dormitory?.name ?? operation.dormitoryId,
        roomSelectionDate: formatDateDot(operation.roomSelectionDate),
        roomSelectionDateRaw: operation.roomSelectionDate,
      };
    });
}

function buildMatchingWindowViewModel({
  dashboard,
  dormitoryName,
  selectedDormitoryId,
  renderedAt,
}: {
  dashboard: HomeDashboardResponse;
  dormitoryName: string | null;
  selectedDormitoryId: string | null;
  renderedAt: number;
}): HomeDashboardMatchingWindowViewModel | null {
  if (!dashboard.season.hasCurrentSeason || !dashboard.season.schedule?.matchingStart) {
    return null;
  }

  const selectedDormitoryOperation =
    selectedDormitoryId === null
      ? null
      : (dashboard.season.operatedDormitories.find(
          (operation) => operation.dormitoryId === selectedDormitoryId && operation.isOperated,
        ) ?? null);
  const roomSelectionDate =
    selectedDormitoryOperation?.roomSelectionDate ?? dashboard.season.schedule.matchingEnd ?? null;

  if (!roomSelectionDate) {
    return null;
  }

  const matchingStartTs = toKstStartOfDayTimestamp(dashboard.season.schedule.matchingStart);
  const roomSelectionEndTs = toKstEndOfDayTimestamp(roomSelectionDate);
  const progressPercent = calculateProgressPercent({
    startTs: matchingStartTs,
    endTs: roomSelectionEndTs,
    currentTs: renderedAt,
  });

  return {
    matchingStartDate: formatDateDot(dashboard.season.schedule.matchingStart),
    matchingStartDateShort: formatDateMonthDayDot(dashboard.season.schedule.matchingStart),
    roomSelectionDate: formatDateDot(roomSelectionDate),
    roomSelectionDateShort: formatDateMonthDayDot(roomSelectionDate),
    roomSelectionDormitoryName:
      dormitoryName ??
      (selectedDormitoryOperation ? selectedDormitoryOperation.dormitoryId : '기숙사'),
    daysUntilRoomSelection: calcDaysUntilTimestamp(roomSelectionEndTs, renderedAt),
    progressPercent,
  };
}

function toKstStartOfDayTimestamp(date: string): number {
  return new Date(`${date}T00:00:00+09:00`).getTime();
}

function toKstEndOfDayTimestamp(date: string): number {
  return new Date(`${date}T23:59:59.999+09:00`).getTime();
}

function calculateProgressPercent({
  startTs,
  endTs,
  currentTs,
}: {
  startTs: number;
  endTs: number;
  currentTs: number;
}): number {
  const duration = endTs - startTs;
  if (duration <= 0) return 100;

  const elapsed = currentTs - startTs;
  const ratio = Math.min(1, Math.max(0, elapsed / duration));

  return Math.round(ratio * 100);
}

function buildSeasonSummaryViewModel({
  dashboard,
  schedule,
  renderedAt,
}: {
  dashboard: HomeDashboardResponse;
  schedule: HomeDashboardScheduleViewModel;
  renderedAt: number;
}): HomeDashboardSeasonSummaryViewModel {
  const nextSeason = dashboard.nextSeasonPreview?.visibleToUser
    ? dashboard.nextSeasonPreview
    : null;
  const lastSeason = dashboard.seasonHistorySummary.lastSeason;
  const nextSeasonStart = nextSeason?.preparationStartDate ?? null;
  const nextSeasonStartTs = nextSeasonStart
    ? new Date(`${nextSeasonStart}T00:00:00+09:00`).getTime()
    : null;

  return {
    pastSeasonName: lastSeason?.name ?? dashboard.season.summary?.name ?? '지난 시즌',
    lastSeason,
    daysUntilNext:
      nextSeasonStartTs !== null
        ? calcDaysUntilTimestamp(nextSeasonStartTs, renderedAt)
        : schedule.hasUpcomingSeasonWindow
          ? schedule.daysUntilOpenStart
          : 0,
    nextSeasonDate:
      nextSeasonStart !== null
        ? formatDateDot(nextSeasonStart)
        : schedule.hasUpcomingSeasonWindow
          ? schedule.openStartFormatted
          : '',
    nextSeasonName:
      nextSeason?.name ??
      (schedule.hasUpcomingSeasonWindow
        ? getNextSeasonName(dashboard.season.summary?.name ?? '')
        : ''),
    hasNextSeasonPreview: nextSeason !== null || schedule.hasUpcomingSeasonWindow,
  };
}

function getNextSeasonName(currentName: string): string {
  const firstSemester = currentName.match(/^(\d{4})년\s*1학기$/);
  if (firstSemester) return `${firstSemester[1]}년 2학기`;

  const secondSemester = currentName.match(/^(\d{4})년\s*2학기$/);
  if (secondSemester) return `${Number(secondSemester[1]) + 1}년 1학기`;

  return currentName ? `${currentName} 다음 시즌` : '다음 시즌';
}

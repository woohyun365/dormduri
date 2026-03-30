'use client';

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Building2, Calendar, School, ShieldAlert } from 'lucide-react';
import {
  getDormitoryById,
  isCampusOperated as isCampusOperatedFn,
  CAMPUS_NAMES,
} from '@/constants/dormitory';
import { isDormitoryAssigned } from '@/utils/dormitory';
import { getAvatarColor } from '@/utils/avatarColor';
import { useSeasonContext } from '@/contexts/SeasonContext';
import { doesRequestTargetUser, isRequestExpired } from '@/utils/matchRequest';
import { isLifestyleRequiredComplete } from '@/utils/lifestyle';
import { calcSeasonDates } from '@/constants/season';
import { OfflineBanner } from '@/components/OfflineBanner';
import { formatDateDot, calcDaysUntilTimestamp } from '@/utils/date';
import { readHomeMatchingSummaryOverrides } from '@/main/utils/homeDevOverrides';
import { HomeSeasonBanner } from './HomeSeasonBanner';
import { HomeMatchingSummary } from './HomeMatchingSummary';
import type { MatchingSummaryStatus } from './HomeMatchingSummary';
import { SeasonPreparationCard } from './SeasonPreparationCard';
import { SeasonSummaryCard } from './SeasonSummaryCard';
import { HomeQuickMenuSection } from './HomeQuickMenuSection';
import { BuildingStatsBar } from './BuildingStatsBar';
import { DynamicTipBanner } from './DynamicTipBanner';
import type { TipSeasonStatus } from './DynamicTipBanner';
import type { TabId, UserProfile, RoommateProfile, MatchingNavOptions } from '@/types/profile';
import type { MatchRequest, ActiveMatch } from '@/types/match';
import type { BuildingStats, PastSeasonResult } from '@/main/types/home';

interface HomeTabProps {
  user: UserProfile;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
  profiles: Omit<RoommateProfile, 'matchScore'>[];
  buildingStats: BuildingStats;
  pastSeasonResult?: PastSeasonResult;
  isNextSeasonRegistered: boolean;
  unreadMessages: number;
  onOpenBuildingSelect?: () => void;
  matchRequests: MatchRequest[];
  activeMatch: ActiveMatch | null;
}

function getMissingOptionalFields(user: UserProfile): string[] {
  const fields: string[] = [];
  if (!user.messageToRoommate) fields.push('룸메에게 한마디');
  if (!user.additional.college) fields.push('단대');
  if (!user.additional.grade) fields.push('학년');
  if (!user.additional.mbti) fields.push('MBTI');
  if (!user.additional.birthYear) fields.push('출생연도');
  return fields;
}

export default function HomeTab({
  user,
  onNavigate,
  profiles,
  buildingStats,
  pastSeasonResult,
  isNextSeasonRegistered,
  unreadMessages,
  onOpenBuildingSelect,
  matchRequests,
  activeMatch,
}: HomeTabProps) {
  const [renderedAt] = useState(() => Date.now());
  const isUnassigned = !isDormitoryAssigned(user.dormitoryId);
  const dormitory = isDormitoryAssigned(user.dormitoryId)
    ? getDormitoryById(user.dormitoryId)
    : null;
  const { season, state: seasonState, isMatching, daysUntilEnd } = useSeasonContext();
  const isCampusOperated = isCampusOperatedFn(user.campus);

  const matchingSummary = useMemo(() => {
    const receivedPending = matchRequests.filter(
      (request) =>
        doesRequestTargetUser(request, user.id) &&
        request.status === 'PENDING' &&
        !isRequestExpired(request),
    );
    const sentPending = matchRequests.filter(
      (request) =>
        request.fromUserId === user.id &&
        request.status === 'PENDING' &&
        !isRequestExpired(request),
    );
    const conversations = matchRequests.filter((request) => request.status === 'IN_CONVERSATION');

    const expiringCount = receivedPending.filter((request) => {
      const remaining = new Date(request.expiresAt).getTime() - renderedAt;
      return remaining > 0 && remaining <= 48 * 60 * 60 * 1000;
    }).length;

    const receivedRequesters = receivedPending
      .map((request) => profiles.find((profile) => profile.id === request.fromUserId)?.nickname)
      .filter((nickname): nickname is string => nickname != null);

    const overrides = readHomeMatchingSummaryOverrides();
    const finalSent = overrides.sentRequests ?? sentPending.length;
    const finalReceived = overrides.receivedRequests ?? receivedPending.length;
    const finalChats = overrides.activeChats ?? conversations.length;

    let status: MatchingSummaryStatus;
    if (!isCampusOperated) status = 'NOT_OPERATED';
    else if (seasonState === 'OFF_SEASON') status = 'OFF_SEASON';
    else if (seasonState === 'SEASON_OPEN') status = 'SEASON_OPEN';
    else if (activeMatch) status = 'ACTIVE_MATCH';
    else if (finalReceived > 0 || finalSent > 0 || finalChats > 0) status = 'HAS_ACTIVITY';
    else status = 'NO_ACTIVITY';

    return {
      status,
      stats: {
        sentRequests: finalSent,
        receivedRequests: finalReceived,
        activeChats: finalChats,
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
    };
  }, [activeMatch, isCampusOperated, matchRequests, profiles, renderedAt, seasonState, user.id]);

  const missingFields = getMissingOptionalFields(user);
  const optionalCompleted = 5 - missingFields.length;
  const hasLifestyle = isLifestyleRequiredComplete(user.lifestyle);

  const tipSeasonStatus: TipSeasonStatus = !isCampusOperated
    ? 'NOT_OPERATED'
    : activeMatch
      ? 'ACTIVE_MATCH'
      : seasonState === 'OFF_SEASON'
        ? 'OFF_SEASON'
        : seasonState === 'SEASON_OPEN'
          ? 'SEASON_OPEN'
          : isUnassigned
            ? 'SEASON_MATCHING_NO_BUILDING'
            : 'SEASON_MATCHING';

  const seasonDates = useMemo(() => {
    const { openStart, matchStart } = calcSeasonDates(season.roomSelectionDate);
    const openStartTs = new Date(`${openStart}T00:00:00+09:00`).getTime();
    const matchStartTs = new Date(`${matchStart}T00:00:00+09:00`).getTime();

    const lifestyleScore = hasLifestyle ? 40 : 0;
    const buildingScore = dormitory ? 30 : 0;
    const optionalScore = (optionalCompleted / 5) * 30;

    return {
      matchStartFormatted: formatDateDot(matchStart),
      openStartFormatted: formatDateDot(openStart),
      daysUntilMatchStart: calcDaysUntilTimestamp(matchStartTs, renderedAt),
      daysUntilOpenStart: calcDaysUntilTimestamp(openStartTs, renderedAt),
      isNextSeasonRegistered,
      profileCompletion: Math.round(lifestyleScore + buildingScore + optionalScore),
    };
  }, [
    dormitory,
    hasLifestyle,
    isNextSeasonRegistered,
    optionalCompleted,
    renderedAt,
    season.roomSelectionDate,
  ]);

  return (
    <div>
      <OfflineBanner />

      <header className="bg-[var(--knu-primary)] text-white px-5 py-6">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm opacity-90 mb-1">안녕하세요,</p>
              <h1 className="text-2xl font-bold">{user.nickname}님</h1>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onNavigate('profile')}
              className={`w-14 h-14 ${getAvatarColor(user.nickname).bg} rounded-full flex items-center justify-center text-2xl font-bold ${getAvatarColor(user.nickname).text} cursor-pointer`}
            >
              {user.nickname.charAt(0)}
            </motion.button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm opacity-90">
              <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-semibold">
                {user.gender === 'M' ? '남' : '여'}
              </span>
              {dormitory ? (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-full text-xs font-semibold">
                  <Building2 className="w-3.5 h-3.5" />
                  {dormitory.name} · {dormitory.roomType}인실
                </span>
              ) : seasonState === 'OFF_SEASON' || !isCampusOperated ? (
                <span className="flex items-center gap-1">
                  <School className="w-3.5 h-3.5" />
                  {CAMPUS_NAMES[user.campus]}
                </span>
              ) : isUnassigned ? (
                <span className="flex items-center gap-1 opacity-75">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  건물 미배정
                </span>
              ) : null}
            </div>
            {isMatching && daysUntilEnd > 0 && (
              <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-xs font-semibold">
                <Calendar className="w-3 h-3" />
                <span>D-{daysUntilEnd}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="relative">
        {!isCampusOperated && (
          <div className="absolute inset-0 z-10 backdrop-blur-[8px] bg-white/60 border border-white/30 flex items-center justify-center">
            <div className="text-center px-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-base font-bold text-[var(--knu-text-primary)] mb-1">
                서비스 운영 준비 중이에요!
              </p>
              <p className="text-sm text-[var(--knu-text-secondary)]">조금만 기다려주세요.</p>
            </div>
          </div>
        )}

        <div
          data-testid="home-content"
          inert={!isCampusOperated}
          aria-hidden={!isCampusOperated}
          className={`max-w-md mx-auto px-5 py-5 space-y-5 ${
            !isCampusOperated ? 'pointer-events-none select-none grayscale-[50%]' : ''
          }`}
        >
          <HomeSeasonBanner isUnassigned={isUnassigned} hasActiveMatch={activeMatch !== null}>
            <BuildingStatsBar
              seasonState={seasonState}
              hasBuilding={dormitory !== null}
              buildingName={dormitory?.name}
              totalCount={
                seasonState === 'OFF_SEASON'
                  ? buildingStats.totalParticipants
                  : buildingStats.assignedParticipants
              }
              buildingCount={
                seasonState === 'SEASON_MATCHING'
                  ? buildingStats.buildingMatchable
                  : buildingStats.buildingTotal
              }
              todayNewTotal={seasonState === 'OFF_SEASON' ? 0 : buildingStats.todayNewTotal}
              todayNewBuilding={seasonState === 'OFF_SEASON' ? 0 : buildingStats.todayNewBuilding}
              matchSuccessCount={
                seasonState === 'SEASON_MATCHING'
                  ? buildingStats.buildingMatchSuccess || buildingStats.totalMatchSuccess
                  : seasonState === 'OFF_SEASON'
                    ? buildingStats.totalMatchSuccess
                    : 0
              }
              urgency={
                seasonState === 'SEASON_MATCHING'
                  ? daysUntilEnd <= 3
                    ? 'critical'
                    : daysUntilEnd <= 7
                      ? 'warning'
                      : 'normal'
                  : 'normal'
              }
              daysLeft={daysUntilEnd}
            />
          </HomeSeasonBanner>

          {seasonState === 'SEASON_MATCHING' && (
            <HomeMatchingSummary
              status={matchingSummary.status}
              stats={matchingSummary.stats}
              activeMatch={matchingSummary.activeMatch}
              receivedRequesters={matchingSummary.receivedRequesters}
              gatingReason={isUnassigned ? 'no_building' : null}
              onGatedAction={() => onOpenBuildingSelect?.()}
              onNavigate={onNavigate}
            />
          )}

          {seasonState === 'SEASON_OPEN' && (
            <SeasonPreparationCard
              daysUntilStart={seasonDates.daysUntilMatchStart}
              seasonStartDate={seasonDates.matchStartFormatted}
              profileCompletion={seasonDates.profileCompletion}
              hasBuilding={dormitory !== null}
              canSelectBuilding={true}
              hasLifestylePattern={hasLifestyle}
              onNavigateProfile={() => onNavigate('profile')}
              onOpenBuildingSelect={() => onOpenBuildingSelect?.()}
              missingFields={missingFields}
            />
          )}

          {seasonState === 'OFF_SEASON' &&
            (() => {
              const currentName = season.name;
              const nextName = currentName.includes('1학기')
                ? currentName.replace('1학기', '2학기')
                : `${parseInt(currentName) + 1}년 1학기`;
              const nextDays = seasonDates.isNextSeasonRegistered
                ? seasonDates.daysUntilOpenStart
                : 0;
              const nextDate = seasonDates.isNextSeasonRegistered
                ? seasonDates.openStartFormatted
                : '';

              return (
                <SeasonSummaryCard
                  pastSeasonName={currentName}
                  daysUntilNext={nextDays}
                  nextSeasonDate={nextDate}
                  nextSeasonName={seasonDates.isNextSeasonRegistered ? nextName : ''}
                  pastSeasonResult={pastSeasonResult}
                  onViewHistory={() => onNavigate('matching', { section: 'past' })}
                />
              );
            })()}

          {seasonState === 'SEASON_MATCHING' && (
            <DynamicTipBanner
              seasonStatus={tipSeasonStatus}
              receivedRequests={matchingSummary.stats.receivedRequests}
              sentRequests={matchingSummary.stats.sentRequests}
              activeChats={matchingSummary.stats.activeChats}
              unreadMessages={unreadMessages}
            />
          )}

          <HomeQuickMenuSection
            seasonState={seasonState}
            onNavigateList={() => onNavigate('list')}
            onNavigateMatching={() => onNavigate('matching', { section: 'current' })}
            onNavigateMatchingHistory={() => onNavigate('matching', { section: 'past' })}
            onNavigateChat={() => {}}
            onNavigateProfile={() => onNavigate('profile')}
          />
        </div>
      </div>
    </div>
  );
}

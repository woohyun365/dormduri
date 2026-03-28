'use client';

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Building2, AlertTriangle, Calendar } from 'lucide-react';
import { getDormitoryById } from '@/constants/dormitory';
import { isDormitoryAssigned } from '@/utils/dormitory';
import { getAvatarColor } from '@/utils/avatarColor';
import { useSeasonContext } from '@/contexts/SeasonContext';
import { isRequestExpired } from '@/utils/matchRequest';
import { HomeSeasonBanner } from './HomeSeasonBanner';
import { UrgentActionBanner } from './UrgentActionBanner';
import { HomeMatchingSummary } from './HomeMatchingSummary';
import type { MatchingSummaryStatus } from './HomeMatchingSummary';
import { HomeQuickMenuSection } from './HomeQuickMenuSection';
import { HomeBuildingSection } from './HomeBuildingSection';
import { HomeProgressSection } from './HomeProgressSection';
import { DynamicTipBanner } from './DynamicTipBanner';
import type { TipSeasonStatus } from './DynamicTipBanner';
import type { TabId, UserProfile, RoommateProfile } from '@/types/profile';
import type { MatchRequest, ActiveMatch } from '@/types/match';

export interface BuildingStats {
  activeUsers: number;
  matchableUsers: number;
  todayNewUsers: number;
  popularCondition: string;
}

interface HomeTabProps {
  user: UserProfile;
  onNavigate: (tab: TabId) => void;
  profiles: Omit<RoommateProfile, 'matchScore'>[];
  buildingStats?: BuildingStats;
  bookmarkedUserIds?: Set<string>;
  isChecklistDismissed?: boolean;
  forceShowChecklist?: boolean;
  onDismissChecklist?: () => void;
  onOpenBuildingSelect?: () => void;
  matchRequests: MatchRequest[];
  activeMatch: ActiveMatch | null;
  receivedPendingCount: number;
}

export default function HomeTab({
  user,
  onNavigate,
  profiles,
  buildingStats,
  bookmarkedUserIds,
  isChecklistDismissed,
  forceShowChecklist,
  onDismissChecklist,
  onOpenBuildingSelect,
  matchRequests,
  activeMatch,
  receivedPendingCount,
}: HomeTabProps) {
  const isUnassigned = !isDormitoryAssigned(user.dormitoryId);
  const dormitory = isDormitoryAssigned(user.dormitoryId)
    ? getDormitoryById(user.dormitoryId)
    : null;
  const { state: seasonState, isMatching, daysUntilEnd } = useSeasonContext();
  const isCampusOperated = user.campus === 'CHUNCHEON';

  // HomeMatchingSummary용 계산
  const matchingSummary = useMemo(() => {
    const receivedPending = matchRequests.filter(
      (r) => r.toUserId === user.id && r.status === 'PENDING' && !isRequestExpired(r),
    );
    const sentPending = matchRequests.filter(
      (r) => r.fromUserId === user.id && r.status === 'PENDING' && !isRequestExpired(r),
    );
    const conversations = matchRequests.filter((r) => r.status === 'IN_CONVERSATION');

    // 상태 판정
    let status: MatchingSummaryStatus;
    if (!isCampusOperated) status = 'NOT_OPERATED';
    else if (seasonState === 'OFF_SEASON') status = 'OFF_SEASON';
    else if (seasonState === 'SEASON_OPEN') status = 'SEASON_OPEN';
    else if (activeMatch) status = 'ACTIVE_MATCH';
    else if (receivedPending.length > 0 || sentPending.length > 0 || conversations.length > 0)
      status = 'HAS_ACTIVITY';
    else status = 'NO_ACTIVITY';

    // 받은 요청자 닉네임
    const receivedRequesters = receivedPending
      .map((r) => profiles.find((p) => p.id === r.fromUserId)?.nickname)
      .filter((n): n is string => n != null);

    return {
      status,
      stats: {
        sentRequests: sentPending.length,
        receivedRequests: receivedPending.length,
        activeChats: conversations.length,
      },
      activeMatch: activeMatch
        ? { nickname: activeMatch.partnerNickname, matchScore: activeMatch.matchScore }
        : undefined,
      receivedRequesters,
    };
  }, [matchRequests, activeMatch, user.id, isCampusOperated, seasonState, profiles]);

  // DynamicTipBanner용 시즌 상태
  const tipSeasonStatus: TipSeasonStatus = !isCampusOperated
    ? 'NOT_OPERATED'
    : activeMatch
      ? 'ACTIVE_MATCH'
      : seasonState === 'OFF_SEASON'
        ? 'OFF_SEASON'
        : seasonState === 'SEASON_OPEN'
          ? 'SEASON_OPEN'
          : 'SEASON_MATCHING';

  return (
    <div>
      {/* Header */}
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
                <span>
                  {dormitory.name} · {dormitory.roomType}인실
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

      <div className="max-w-md mx-auto px-5 py-5 space-y-5">
        <HomeSeasonBanner isUnassigned={isUnassigned} />

        <UrgentActionBanner
          matchRequests={matchRequests}
          userId={user.id}
          profiles={profiles}
          onNavigate={onNavigate}
        />

        <HomeMatchingSummary
          status={matchingSummary.status}
          stats={matchingSummary.stats}
          activeMatch={matchingSummary.activeMatch}
          receivedRequesters={matchingSummary.receivedRequesters}
          onNavigate={onNavigate}
        />

        <DynamicTipBanner
          seasonStatus={tipSeasonStatus}
          receivedRequests={matchingSummary.stats.receivedRequests}
          sentRequests={matchingSummary.stats.sentRequests}
          activeChats={matchingSummary.stats.activeChats}
        />

        <HomeQuickMenuSection
          onNavigateList={() => onNavigate('list')}
          onNavigateMatching={() => onNavigate('matching')}
          onNavigateChat={() => {}}
          onNavigateProfile={() => onNavigate('profile')}
          receivedPendingCount={receivedPendingCount}
        />

        <HomeBuildingSection
          hasBuilding={dormitory !== null}
          buildingName={dormitory?.name}
          roomType={dormitory ? `${dormitory.roomType}인실` : undefined}
          totalParticipants={buildingStats?.activeUsers ?? 0}
          todayNewTotal={buildingStats?.todayNewUsers ?? 0}
          buildingParticipants={buildingStats?.matchableUsers ?? 0}
          todayNewBuilding={0}
          matchSuccessCount={0}
          onRegisterBuilding={() => onNavigate('profile')}
          onBuildingClick={() => onNavigate('list')}
        />

        <HomeProgressSection
          user={user}
          bookmarkedUserIds={bookmarkedUserIds ?? new Set()}
          isChecklistDismissed={isChecklistDismissed}
          forceShowChecklist={forceShowChecklist}
          onDismissChecklist={onDismissChecklist}
          onNavigate={onNavigate}
          onOpenBuildingSelect={onOpenBuildingSelect}
        />
      </div>
    </div>
  );
}

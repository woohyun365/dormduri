'use client';

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Calendar } from 'lucide-react';
import { getDormitoryById } from '@/constants/dormitory';
import { isDormitoryAssigned } from '@/utils/dormitory';
import { getAvatarColor } from '@/utils/avatarColor';
import { useSeasonContext } from '@/contexts/SeasonContext';
import { isRequestExpired } from '@/utils/matchRequest';
import { calcSeasonDates } from '@/constants/season';
import { PullToRefresh } from '@/components/PullToRefresh';
import { OfflineBanner } from '@/components/OfflineBanner';
import { HomeSeasonBanner } from './HomeSeasonBanner';
import { UrgentActionBanner } from './UrgentActionBanner';
import { HomeMatchingSummary } from './HomeMatchingSummary';
import type { MatchingSummaryStatus } from './HomeMatchingSummary';
import { SeasonPreparationCard } from './SeasonPreparationCard';
import { SeasonSummaryCard } from './SeasonSummaryCard';
import { HomeQuickMenuSection } from './HomeQuickMenuSection';
import { HomeBuildingSection } from './HomeBuildingSection';
import { ProfileCompletionCard } from './ProfileCompletionCard';
import { MatchingReadinessCard } from './MatchingReadinessCard';
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
  onOpenBuildingSelect?: () => void;
  matchRequests: MatchRequest[];
  activeMatch: ActiveMatch | null;
  receivedPendingCount: number;
}

// 선택 항목 미작성 필드 계산
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
  onOpenBuildingSelect,
  matchRequests,
  activeMatch,
  receivedPendingCount,
}: HomeTabProps) {
  const isUnassigned = !isDormitoryAssigned(user.dormitoryId);
  const dormitory = isDormitoryAssigned(user.dormitoryId)
    ? getDormitoryById(user.dormitoryId)
    : null;
  const { season, state: seasonState, isMatching, daysUntilEnd } = useSeasonContext();
  const isCampusOperated = user.campus === 'CHUNCHEON';

  // --- 매칭 활동 요약 ---
  const matchingSummary = useMemo(() => {
    const receivedPending = matchRequests.filter(
      (r) => r.toUserId === user.id && r.status === 'PENDING' && !isRequestExpired(r),
    );
    const sentPending = matchRequests.filter(
      (r) => r.fromUserId === user.id && r.status === 'PENDING' && !isRequestExpired(r),
    );
    const conversations = matchRequests.filter((r) => r.status === 'IN_CONVERSATION');

    // 만료 임박 (48h 이내)
    const now = Date.now();
    const expiringCount = receivedPending.filter((r) => {
      const remaining = new Date(r.expiresAt).getTime() - now;
      return remaining > 0 && remaining <= 48 * 60 * 60 * 1000;
    }).length;

    let status: MatchingSummaryStatus;
    if (!isCampusOperated) status = 'NOT_OPERATED';
    else if (seasonState === 'OFF_SEASON') status = 'OFF_SEASON';
    else if (seasonState === 'SEASON_OPEN') status = 'SEASON_OPEN';
    else if (activeMatch) status = 'ACTIVE_MATCH';
    else if (receivedPending.length > 0 || sentPending.length > 0 || conversations.length > 0)
      status = 'HAS_ACTIVITY';
    else status = 'NO_ACTIVITY';

    const receivedRequesters = receivedPending
      .map((r) => profiles.find((p) => p.id === r.fromUserId)?.nickname)
      .filter((n): n is string => n != null);

    return {
      status,
      stats: {
        sentRequests: sentPending.length,
        receivedRequests: receivedPending.length,
        activeChats: conversations.length,
        expiringCount,
      },
      activeMatch: activeMatch
        ? { nickname: activeMatch.partnerNickname, matchScore: activeMatch.matchScore }
        : undefined,
      receivedRequesters,
    };
  }, [matchRequests, activeMatch, user.id, isCampusOperated, seasonState, profiles]);

  // --- 프로필 완성도 ---
  const missingFields = getMissingOptionalFields(user);
  const optionalCompleted = 5 - missingFields.length;
  const hasLifestyle = true; // 가입 시 필수 입력 완료

  // --- 팁 ---
  const tipSeasonStatus: TipSeasonStatus = !isCampusOperated
    ? 'NOT_OPERATED'
    : activeMatch
      ? 'ACTIVE_MATCH'
      : seasonState === 'OFF_SEASON'
        ? 'OFF_SEASON'
        : seasonState === 'SEASON_OPEN'
          ? 'SEASON_OPEN'
          : 'SEASON_MATCHING';

  // --- 시즌 오픈 날짜 ---
  const seasonDates = useMemo(() => {
    const { matchStart } = calcSeasonDates(season.roomSelectionDate);
    const now = Date.now();
    const matchStartTs = new Date(matchStart + 'T00:00:00+09:00').getTime();
    const daysUntilMatchStart = Math.max(
      0,
      Math.ceil((matchStartTs - now) / (1000 * 60 * 60 * 24)),
    );

    // 시즌 오픈용 준비 완료도
    const lifestyleScore = hasLifestyle ? 40 : 0;
    const buildingScore = dormitory ? 30 : 0;
    const optionalScore = (optionalCompleted / 5) * 30;

    return {
      matchStartFormatted: `${new Date(matchStart).getFullYear()}.${String(new Date(matchStart).getMonth() + 1).padStart(2, '0')}.${String(new Date(matchStart).getDate()).padStart(2, '0')}`,
      daysUntilMatchStart,
      profileCompletion: Math.round(lifestyleScore + buildingScore + optionalScore),
    };
  }, [season.roomSelectionDate, hasLifestyle, dormitory, optionalCompleted]);

  const handleRefresh = async () => {
    // Mock: 실제로는 API 재호출. 현재는 1초 대기
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  return (
    <div>
      <OfflineBanner />

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

      <PullToRefresh onRefresh={handleRefresh}>
        <div className="max-w-md mx-auto px-5 py-5 space-y-5">
          {/* 시즌 배너 (공통) */}
          <HomeSeasonBanner isUnassigned={isUnassigned} />

          {/* 긴급 알림 (MATCHING만) */}
          {seasonState === 'SEASON_MATCHING' && (
            <UrgentActionBanner
              matchRequests={matchRequests}
              userId={user.id}
              profiles={profiles}
              onNavigate={onNavigate}
            />
          )}

          {/* === 매칭 활동 영역 (시즌별 교체) === */}
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
              optionalFieldsCompleted={optionalCompleted}
              optionalFieldsTotal={5}
              waitingCount={buildingStats?.activeUsers ?? 0}
              onPrepare={() => onNavigate('profile')}
            />
          )}

          {seasonState === 'OFF_SEASON' && (
            <SeasonSummaryCard
              pastSeasonName={`${season.name}`}
              daysUntilNext={0}
              nextSeasonDate=""
              nextSeasonName=""
              hasRegisteredNext={false}
              onUpdateProfile={() => onNavigate('profile')}
              onRegisterNext={() => {}}
            />
          )}

          {/* 동적 팁 (공통) */}
          <DynamicTipBanner
            seasonStatus={tipSeasonStatus}
            receivedRequests={matchingSummary.stats.receivedRequests}
            sentRequests={matchingSummary.stats.sentRequests}
            activeChats={matchingSummary.stats.activeChats}
            unreadMessages={0}
          />

          {/* 퀵메뉴 (공통) */}
          <HomeQuickMenuSection
            onNavigateList={() => onNavigate('list')}
            onNavigateMatching={() => onNavigate('matching')}
            onNavigateChat={() => {}}
            onNavigateProfile={() => onNavigate('profile')}
            receivedPendingCount={receivedPendingCount}
          />

          {/* 건물 현황 (공통) */}
          <HomeBuildingSection
            hasBuilding={dormitory !== null}
            buildingName={dormitory?.name}
            roomType={dormitory ? `${dormitory.roomType}인실` : undefined}
            totalParticipants={buildingStats?.activeUsers ?? 0}
            todayNewTotal={buildingStats?.todayNewUsers ?? 0}
            buildingParticipants={buildingStats?.matchableUsers ?? 0}
            todayNewBuilding={0}
            matchSuccessCount={0}
            onRegisterBuilding={() => onOpenBuildingSelect?.()}
            onBuildingClick={() => onNavigate('list')}
          />

          {/* === 프로필 영역 (시즌별 교체) === */}
          {seasonState === 'SEASON_MATCHING' ? (
            <MatchingReadinessCard
              hasLifestylePattern={hasLifestyle}
              hasBuildingAssigned={dormitory !== null}
              buildingName={dormitory?.name}
              roomType={dormitory ? `${dormitory.roomType}인실` : undefined}
              optionalFieldsCompleted={optionalCompleted}
              optionalFieldsTotal={5}
              missingFields={missingFields}
              onCompleteProfile={() => onNavigate('profile')}
            />
          ) : (
            <ProfileCompletionCard
              hasLifestylePattern={hasLifestyle}
              optionalFieldsCompleted={optionalCompleted}
              optionalFieldsTotal={5}
              missingFields={missingFields}
              onCompleteProfile={() => onNavigate('profile')}
            />
          )}
        </div>
      </PullToRefresh>
    </div>
  );
}

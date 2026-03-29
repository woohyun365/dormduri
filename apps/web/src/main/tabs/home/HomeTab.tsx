'use client';

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Calendar, School, ShieldAlert } from 'lucide-react';
import {
  getDormitoryById,
  isCampusOperated as isCampusOperatedFn,
  CAMPUS_NAMES,
} from '@/constants/dormitory';
import { isDormitoryAssigned } from '@/utils/dormitory';
import { getAvatarColor } from '@/utils/avatarColor';
import { useSeasonContext } from '@/contexts/SeasonContext';
import { isRequestExpired } from '@/utils/matchRequest';
import { calcSeasonDates } from '@/constants/season';
import { PullToRefresh } from '@/components/PullToRefresh';
import {
  MATCH_SENT_OVERRIDE_KEY,
  MATCH_RECEIVED_OVERRIDE_KEY,
  MATCH_CHATS_OVERRIDE_KEY,
  PAST_SEASON_OVERRIDE_KEY,
  NEXT_SEASON_REGISTERED_KEY,
} from '../../components/HomeDevTool';
import { OfflineBanner } from '@/components/OfflineBanner';
import { HomeSeasonBanner } from './HomeSeasonBanner';
import { UrgentActionBanner } from './UrgentActionBanner';
import { HomeMatchingSummary } from './HomeMatchingSummary';
import type { MatchingSummaryStatus } from './HomeMatchingSummary';
import { SeasonPreparationCard } from './SeasonPreparationCard';
import { SeasonSummaryCard } from './SeasonSummaryCard';
import { HomeQuickMenuSection } from './HomeQuickMenuSection';
import { BuildingStatsBar } from './BuildingStatsBar';
import { DynamicTipBanner } from './DynamicTipBanner';
import type { TipSeasonStatus } from './DynamicTipBanner';
import type { TabId, UserProfile, RoommateProfile } from '@/types/profile';
import type { MatchRequest, ActiveMatch } from '@/types/match';

export interface BuildingStats {
  /** 전체 프로필 수 (남녀, 건물 무관) — 비시즌 "이전 시즌 전체 참여" */
  totalParticipants: number;
  /** 건물 배정 유저 수 (미배정 제외) — 시즌 오픈/매칭 "전체 대기/참여" */
  assignedParticipants: number;
  /** 같은 건물 + 같은 성별 — 시즌 매칭 "내 건물" */
  buildingMatchable: number;
  /** 같은 건물 전체 (남녀) — 시즌 오픈 "00관 대기", 비시즌 "내 건물" */
  buildingTotal: number;
  /** 오늘 신규 전체 (고정 Mock) */
  todayNewTotal: number;
  /** 오늘 신규 내 건물 (고정 Mock) */
  todayNewBuilding: number;
  /** 전체 매칭 성공 (고정 Mock) */
  totalMatchSuccess: number;
  /** 내 건물 매칭 성공 (고정 Mock) */
  buildingMatchSuccess: number;
  /** 인기 조건 */
  popularCondition: string;
}

export interface PastSeasonResult {
  matched: boolean;
  partnerName?: string;
  totalRequests: number;
  sentRequests: number;
  totalChats: number;
}

// Mock 지난 시즌 결과 (Sprint 7 BE에서 실제 데이터로 교체)
function getMockPastSeason(): PastSeasonResult | undefined {
  const override =
    typeof window !== 'undefined' ? localStorage.getItem(PAST_SEASON_OVERRIDE_KEY) : null;
  if (override === 'matched') {
    return {
      matched: true,
      partnerName: '홍길동',
      totalRequests: 5,
      sentRequests: 2,
      totalChats: 3,
    };
  }
  if (override === 'failed') {
    return { matched: false, totalRequests: 8, sentRequests: 3, totalChats: 2 };
  }
  // 'none' 또는 null → 미참여
  return undefined;
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
  const isCampusOperated = isCampusOperatedFn(user.campus);

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

    const receivedRequesters = receivedPending
      .map((r) => profiles.find((p) => p.id === r.fromUserId)?.nickname)
      .filter((n): n is string => n != null);

    // DevTool 오버라이드
    const devSent =
      typeof window !== 'undefined' ? localStorage.getItem(MATCH_SENT_OVERRIDE_KEY) : null;
    const devReceived =
      typeof window !== 'undefined' ? localStorage.getItem(MATCH_RECEIVED_OVERRIDE_KEY) : null;
    const devChats =
      typeof window !== 'undefined' ? localStorage.getItem(MATCH_CHATS_OVERRIDE_KEY) : null;

    const finalSent = devSent !== null ? Number(devSent) : sentPending.length;
    const finalReceived = devReceived !== null ? Number(devReceived) : receivedPending.length;
    const finalChats = devChats !== null ? Number(devChats) : conversations.length;

    // status 판정 (오버라이드 반영 후)
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
          : isUnassigned
            ? 'SEASON_MATCHING_NO_BUILDING'
            : 'SEASON_MATCHING';

  // --- 시즌 날짜 계산 ---
  const seasonDates = useMemo(() => {
    const { openStart, matchStart } = calcSeasonDates(season.roomSelectionDate);
    const now = Date.now();
    const openStartTs = new Date(openStart + 'T00:00:00+09:00').getTime();
    const matchStartTs = new Date(matchStart + 'T00:00:00+09:00').getTime();

    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr);
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    };

    // 시즌 오픈용 준비 완료도
    const lifestyleScore = hasLifestyle ? 40 : 0;
    const buildingScore = dormitory ? 30 : 0;
    const optionalScore = (optionalCompleted / 5) * 30;

    return {
      matchStartFormatted: formatDate(matchStart),
      openStartFormatted: formatDate(openStart),
      daysUntilMatchStart: Math.max(0, Math.ceil((matchStartTs - now) / (1000 * 60 * 60 * 24))),
      daysUntilOpenStart: Math.max(0, Math.ceil((openStartTs - now) / (1000 * 60 * 60 * 24))),
      isNextSeasonRegistered:
        typeof window !== 'undefined' && localStorage.getItem(NEXT_SEASON_REGISTERED_KEY) === 'true'
          ? true
          : openStartTs > now,
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
              ) : seasonState === 'OFF_SEASON' ? (
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
        {/* NOT_OPERATED 오버레이 */}
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

        <PullToRefresh onRefresh={handleRefresh}>
          <div
            className={`max-w-md mx-auto px-5 py-5 space-y-5 ${!isCampusOperated ? 'pointer-events-none select-none grayscale-[50%]' : ''}`}
          >
            {/* 시즌 배너 + 건물 통계 (시각적 병합) */}
            <HomeSeasonBanner isUnassigned={isUnassigned}>
              <BuildingStatsBar
                seasonState={seasonState}
                hasBuilding={dormitory !== null}
                buildingName={dormitory?.name}
                totalCount={
                  seasonState === 'OFF_SEASON'
                    ? (buildingStats?.totalParticipants ?? 0)
                    : (buildingStats?.assignedParticipants ?? 0)
                }
                buildingCount={
                  seasonState === 'SEASON_MATCHING'
                    ? (buildingStats?.buildingMatchable ?? 0)
                    : (buildingStats?.buildingTotal ?? 0)
                }
                todayNewTotal={
                  seasonState === 'OFF_SEASON' ? 0 : (buildingStats?.todayNewTotal ?? 0)
                }
                todayNewBuilding={
                  seasonState === 'OFF_SEASON' ? 0 : (buildingStats?.todayNewBuilding ?? 0)
                }
                matchSuccessCount={
                  seasonState === 'SEASON_MATCHING'
                    ? (buildingStats?.buildingMatchSuccess ?? 0) ||
                      (buildingStats?.totalMatchSuccess ?? 0)
                    : seasonState === 'OFF_SEASON'
                      ? (buildingStats?.totalMatchSuccess ?? 0)
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
                waitingCount={buildingStats?.buildingTotal ?? 0}
                onPrepare={() => (dormitory ? onNavigate('profile') : onOpenBuildingSelect?.())}
                onUpdateProfile={() => onNavigate('profile')}
                missingFields={missingFields}
              />
            )}

            {seasonState === 'OFF_SEASON' &&
              (() => {
                // 다음 시즌 이름 생성 (1학기→2학기, 2학기→다음년도 1학기)
                const currentName = season.name; // "2026년 1학기"
                const nextName = currentName.includes('1학기')
                  ? currentName.replace('1학기', '2학기')
                  : `${parseInt(currentName) + 1}년 1학기`;
                const nextDays = seasonDates.isNextSeasonRegistered
                  ? Math.max(seasonDates.daysUntilOpenStart, 30)
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
                    pastSeasonResult={getMockPastSeason()}
                    hasRegisteredNext={false}
                    onViewHistory={() => onNavigate('matching')}
                    onUpdateProfile={() => onNavigate('profile')}
                    missingFields={missingFields}
                  />
                );
              })()}

            {/* 동적 팁 (MATCHING만) */}
            {seasonState === 'SEASON_MATCHING' && (
              <DynamicTipBanner
                seasonStatus={tipSeasonStatus}
                receivedRequests={matchingSummary.stats.receivedRequests}
                sentRequests={matchingSummary.stats.sentRequests}
                activeChats={matchingSummary.stats.activeChats}
                unreadMessages={0}
              />
            )}

            {/* 퀵메뉴 (공통) */}
            <HomeQuickMenuSection
              seasonState={seasonState}
              onNavigateList={() => onNavigate('list')}
              onNavigateMatching={() => onNavigate('matching')}
              onNavigateChat={() => {}}
              onNavigateProfile={() => onNavigate('profile')}
            />
          </div>
        </PullToRefresh>
      </div>
    </div>
  );
}

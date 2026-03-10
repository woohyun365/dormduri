'use client';

import { useRef, useMemo } from 'react';
import { Building2, AlertTriangle } from 'lucide-react';
import { getDormitoryById } from '@/constants/dormitory';
import { isDormitoryAssigned } from '@/utils/dormitory';
import { getAvatarColor } from '@/utils/avatarColor';
import { isRequestExpired } from '@/utils/matchRequest';
import { HomeSeasonBanner } from './HomeSeasonBanner';
import { HomeMatchingSection } from './HomeMatchingSection';
import { HomeQuickMenuSection } from './HomeQuickMenuSection';
import { HomeBuildingSection } from './HomeBuildingSection';
import { HomeProgressSection } from './HomeProgressSection';
import { HomeUsageTipsSection } from './HomeUsageTipsSection';
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
  onShowGuide?: () => void;
  matchRequests: MatchRequest[];
  activeMatch: ActiveMatch | null;
  onCancelRequest?: (requestId: string) => void;
  onAcceptRequest?: (requestId: string) => void;
  onRejectRequest?: (requestId: string) => void;
  onEndMatch?: () => void;
  profiles: Omit<RoommateProfile, 'matchScore'>[];
  buildingStats?: BuildingStats;
  bookmarkedUserIds?: Set<string>;
  isChecklistDismissed?: boolean;
  forceShowChecklist?: boolean;
  onDismissChecklist?: () => void;
  onOpenBuildingSelect?: () => void;
}

export default function HomeTab({
  user,
  onNavigate,
  onShowGuide,
  matchRequests,
  activeMatch,
  onCancelRequest,
  onAcceptRequest,
  onRejectRequest,
  onEndMatch,
  profiles,
  buildingStats,
  bookmarkedUserIds,
  isChecklistDismissed,
  forceShowChecklist,
  onDismissChecklist,
  onOpenBuildingSelect,
}: HomeTabProps) {
  const isUnassigned = !isDormitoryAssigned(user.dormitoryId);
  const dormitory = isDormitoryAssigned(user.dormitoryId)
    ? getDormitoryById(user.dormitoryId)
    : null;
  const matchSectionRef = useRef<HTMLDivElement>(null);

  const receivedPendingCount = useMemo(
    () =>
      matchRequests.filter(
        (r) => r.toUserId === 'me' && r.status === 'PENDING' && !isRequestExpired(r),
      ).length,
    [matchRequests],
  );

  return (
    <div>
      {/* Header */}
      <div className="bg-[var(--knu-primary)] text-white px-5 py-6">
        <div className="max-w-md mx-auto">
          <p className="text-xl font-bold mb-4">안녕하세요,</p>
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 ${getAvatarColor(user.nickname).bg} rounded-2xl flex items-center justify-center text-2xl font-bold ${getAvatarColor(user.nickname).text}`}
            >
              {user.nickname.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{user.nickname}님</h1>
                <span className="px-2 py-0.5 bg-white/20 text-white text-xs font-semibold rounded-full">
                  {user.gender === 'M' ? '남' : '여'}
                </span>
              </div>
              {dormitory ? (
                <div className="mt-1 flex items-center gap-2 text-sm opacity-90">
                  <Building2 className="w-4 h-4" />
                  <span>
                    {dormitory.name} · {dormitory.roomType}인실
                  </span>
                </div>
              ) : isUnassigned ? (
                <div className="mt-1 flex items-center gap-2 text-sm opacity-75">
                  <AlertTriangle className="w-4 h-4" />
                  <span>건물 미배정</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 py-6 space-y-6">
        <HomeSeasonBanner />

        <HomeMatchingSection
          ref={matchSectionRef}
          user={user}
          matchRequests={matchRequests}
          activeMatch={activeMatch}
          profiles={profiles}
          dormitory={dormitory ?? null}
          onCancelRequest={onCancelRequest}
          onAcceptRequest={onAcceptRequest}
          onRejectRequest={onRejectRequest}
          onEndMatch={onEndMatch}
          onNavigateList={() => onNavigate('list')}
        />

        <HomeQuickMenuSection
          onNavigateList={() => onNavigate('list')}
          onScrollToMatch={() => matchSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
          receivedPendingCount={receivedPendingCount}
        />

        <HomeBuildingSection
          dormitory={dormitory ?? null}
          buildingStats={buildingStats}
          profiles={profiles}
          onNavigateProfile={() => onNavigate('profile')}
          onNavigateList={() => onNavigate('list')}
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

        <HomeUsageTipsSection onShowGuide={onShowGuide} />
      </div>
    </div>
  );
}

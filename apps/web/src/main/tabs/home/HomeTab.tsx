'use client';

import { motion } from 'motion/react';
import { Building2, AlertTriangle, Calendar } from 'lucide-react';
import { getDormitoryById } from '@/constants/dormitory';
import { isDormitoryAssigned } from '@/utils/dormitory';
import { getAvatarColor } from '@/utils/avatarColor';
import { useSeasonContext } from '@/contexts/SeasonContext';
import { HomeSeasonBanner } from './HomeSeasonBanner';
import { HomeQuickMenuSection } from './HomeQuickMenuSection';
import { HomeBuildingSection } from './HomeBuildingSection';
import { HomeProgressSection } from './HomeProgressSection';
import { HomeUsageTipsSection } from './HomeUsageTipsSection';
import type { TabId, UserProfile, RoommateProfile } from '@/types/profile';

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
  const { isMatching, daysUntilEnd } = useSeasonContext();

  return (
    <div>
      {/* Header */}
      <div className="bg-[var(--knu-primary)] text-white px-5 py-6">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xl font-bold">안녕하세요,</p>
            {isMatching && daysUntilEnd > 0 && (
              <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-xs font-semibold">
                <Calendar className="w-3 h-3" />
                <span>D-{daysUntilEnd}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onNavigate('profile')}
              className={`w-14 h-14 ${getAvatarColor(user.nickname).bg} rounded-2xl flex items-center justify-center text-2xl font-bold ${getAvatarColor(user.nickname).text} cursor-pointer`}
            >
              {user.nickname.charAt(0)}
            </motion.button>
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
        <HomeSeasonBanner isUnassigned={isUnassigned} />

        <HomeQuickMenuSection
          onNavigateList={() => onNavigate('list')}
          onNavigateMatching={() => onNavigate('matching')}
          onNavigateChat={() => {}}
          onNavigateProfile={() => onNavigate('profile')}
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

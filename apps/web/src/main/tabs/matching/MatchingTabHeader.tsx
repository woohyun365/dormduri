'use client';

import { motion } from 'motion/react';
import { AlertTriangle, Building2, Calendar, School } from 'lucide-react';
import { useSeasonContext } from '@/main/contexts/SeasonContext';
import { getDormitoryById, CAMPUS_NAMES } from '@/constants/dormitory';
import { isDormitoryAssigned } from '@/utils/dormitory';
import { UNASSIGNED_ID } from '@/constants/dormitory';
import { getAvatarColor } from '@/utils/avatarColor';
import type { UserProfile } from '@/types/profile';

interface MatchingTabHeaderProps {
  user: UserProfile;
  onNavigateProfile?: () => void;
}

export function MatchingTabHeader({ user, onNavigateProfile }: MatchingTabHeaderProps) {
  const { state: seasonState, isMatching, daysUntilEnd } = useSeasonContext();

  const dormitory = isDormitoryAssigned(user.dormitoryId)
    ? getDormitoryById(user.dormitoryId)
    : null;

  const isUnassigned = user.dormitoryId === UNASSIGNED_ID || user.dormitoryId === null;
  const avatarColor = getAvatarColor(user.nickname);

  return (
    <header className="bg-[var(--knu-primary)] text-white px-5 py-6">
      <div className="max-w-md mx-auto">
        {/* 상단: 닉네임 + 아바타 */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm opacity-90 mb-1">매칭 현황</p>
            <h1 className="text-2xl font-bold">{user.nickname}님</h1>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onNavigateProfile}
            className={`w-14 h-14 ${avatarColor.bg} rounded-full flex items-center justify-center text-2xl font-bold ${avatarColor.text} cursor-pointer`}
          >
            {user.nickname.charAt(0)}
          </motion.button>
        </div>

        {/* 하단: 성별 pill + 건물 pill + D-day */}
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
            ) : seasonState === 'OFF_SEASON' ? (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-full text-xs font-semibold">
                <School className="w-3.5 h-3.5" />
                {CAMPUS_NAMES[user.campus]}
              </span>
            ) : isUnassigned ? (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-full text-xs font-semibold opacity-75">
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
  );
}

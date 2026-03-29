'use client';

import { motion } from 'motion/react';
import { Handshake } from 'lucide-react';
import { useSeasonContext } from '@/contexts/SeasonContext';
import { getDormitoryById } from '@/constants/dormitory';
import { isDormitoryAssigned } from '@/utils/dormitory';
import type { UserProfile } from '@/types/profile';

interface MatchingTabHeaderProps {
  user: UserProfile;
}

export function MatchingTabHeader({ user }: MatchingTabHeaderProps) {
  const { state: seasonState, daysUntilEnd } = useSeasonContext();

  const dormitory = isDormitoryAssigned(user.dormitoryId)
    ? getDormitoryById(user.dormitoryId)
    : null;

  const seasonLabel =
    seasonState === 'SEASON_MATCHING'
      ? '시즌 매칭 중'
      : seasonState === 'SEASON_OPEN'
        ? '시즌 오픈'
        : '비시즌';

  const parts: string[] = [seasonLabel];
  if (seasonState === 'SEASON_MATCHING' && daysUntilEnd > 0) {
    parts.push(`D-${daysUntilEnd}`);
  }
  if (dormitory) {
    parts.push(`${dormitory.name} ${dormitory.roomType}인실`);
  }

  return (
    <header className="bg-[var(--knu-primary)] text-white px-5 py-4 sticky top-0 z-40">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 2, repeatDelay: 3 }}
          >
            <Handshake className="w-6 h-6" />
          </motion.div>
          <h1 className="text-xl font-bold">매칭 현황</h1>
        </div>
        <p className="text-sm opacity-90">{parts.join(' · ')}</p>
      </div>
    </header>
  );
}

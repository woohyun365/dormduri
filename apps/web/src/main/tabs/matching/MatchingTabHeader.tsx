'use client';

import { motion } from 'motion/react';
import { Handshake } from 'lucide-react';
import { useSeasonContext } from '@/contexts/SeasonContext';
import { getDormitoryById } from '@/constants/dormitory';
import { isDormitoryAssigned } from '@/utils/dormitory';
import { matchingDisplayTitle } from '@/main/styles/matching';
import type { UserProfile } from '@/types/profile';

interface MatchingTabHeaderProps {
  user: UserProfile;
}

export function MatchingTabHeader({ user }: MatchingTabHeaderProps) {
  const { state: seasonState } = useSeasonContext();

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
  if (dormitory) {
    parts.push(`${dormitory.name} ${dormitory.roomType}인실`);
  }

  return (
    <header className="bg-[var(--knu-primary)] px-5 py-6 text-white">
      <div className="max-w-md mx-auto">
        <div className="mb-3 flex items-center gap-2">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 2, repeatDelay: 3 }}
          >
            <Handshake className="w-6 h-6" />
          </motion.div>
          <h1 className={`${matchingDisplayTitle} text-2xl text-white`}>매칭 현황</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {parts.map((part) => (
            <span
              key={part}
              className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold"
            >
              {part}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}

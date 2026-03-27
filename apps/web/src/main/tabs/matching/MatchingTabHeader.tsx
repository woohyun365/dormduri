'use client';

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
    <div className="bg-white border-b-2 border-[var(--knu-border)] px-5 py-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <Handshake className="w-5 h-5 text-[var(--knu-primary)]" />
          <h1 className="text-lg font-bold text-[var(--knu-text-primary)]">매칭 현황</h1>
        </div>
        <p className="text-xs text-[var(--knu-text-tertiary)]">{parts.join(' · ')}</p>
      </div>
    </div>
  );
}

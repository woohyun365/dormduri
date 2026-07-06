'use client';

import { motion } from 'motion/react';
import { AlertTriangle, Building2, Calendar, School } from 'lucide-react';
import { getAvatarColor } from '@/utils/avatarColor';
import type { HomeDashboardViewModel } from '../model/homeDashboardViewModel';

interface HomeHeaderProps {
  viewModel: HomeDashboardViewModel;
  seasonState: HomeDashboardViewModel['seasonState'];
  daysUntilEnd: number;
  onNavigateProfile: () => void;
}

export function HomeHeader({
  viewModel,
  seasonState,
  daysUntilEnd,
  onNavigateProfile,
}: HomeHeaderProps) {
  const avatarColor = getAvatarColor(viewModel.viewerIdentity.nickname);

  return (
    <header className="bg-(--knu-primary) py-6 text-white">
      <div className="mx-auto max-w-md px-5 md:max-w-5xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="mb-1 text-sm opacity-90">안녕하세요,</p>
            <h1 className="text-2xl font-bold">{viewModel.viewerIdentity.nickname}님</h1>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onNavigateProfile}
            className={`flex h-14 w-14 cursor-pointer items-center justify-center rounded-full text-2xl font-bold ${avatarColor.bg} ${avatarColor.text}`}
            aria-label="내 프로필 보기"
          >
            {viewModel.viewerIdentity.avatarInitial}
          </motion.button>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm opacity-90">
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
              {viewModel.viewerIdentity.genderLabel}
            </span>
            {viewModel.dormitory ? (
              <span className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
                <Building2 className="h-3.5 w-3.5" />
                {viewModel.dormitory.name} · {viewModel.dormitory.roomType}인실
              </span>
            ) : seasonState === 'OFF_SEASON' || !viewModel.isCampusOperated ? (
              <span className="flex items-center gap-1">
                <School className="h-3.5 w-3.5" />
                {viewModel.campusName}
              </span>
            ) : viewModel.isUnassigned ? (
              <span className="flex items-center gap-1 opacity-75">
                <AlertTriangle className="h-3.5 w-3.5" />
                건물 미배정
              </span>
            ) : null}
          </div>
          {viewModel.isSeasonMatching && daysUntilEnd > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
              <Calendar className="h-3 w-3" />
              <span>D-{daysUntilEnd}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

'use client';

import { motion } from 'motion/react';
import { Building2, AlertTriangle, Info, Share2, ChevronRight } from 'lucide-react';
import type { Dormitory } from '@/constants/dormitory';
import type { TabId } from '@/types/profile';
import type { BuildingStats } from './HomeTab';
import { MATCHABLE_OVERRIDE_KEY } from '../../components/HomeDevTool';

interface HomeBuildingSectionProps {
  dormitory: Dormitory | null;
  buildingStats?: BuildingStats;
  onNavigateProfile: () => void;
  onNavigateList: () => void;
}

function getMatchableCount(buildingStats?: BuildingStats): number {
  // DevTool 오버라이드 확인
  if (typeof window !== 'undefined') {
    const override = localStorage.getItem(MATCHABLE_OVERRIDE_KEY);
    if (override !== null) return Number(override);
  }
  return buildingStats?.matchableUsers ?? 0;
}

export function HomeBuildingSection({
  dormitory,
  buildingStats,
  onNavigateProfile,
  onNavigateList,
}: HomeBuildingSectionProps) {
  const matchableCount = getMatchableCount(buildingStats);
  const isLowCount = dormitory !== null && matchableCount <= 3;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: '강원대 기숙사 룸메이트 매칭',
          text: '같은 건물 친구와 룸메이트를 찾아보세요!',
          url: window.location.origin,
        });
      } catch {
        // 사용자가 공유 취소
      }
    }
  };

  // 1. 건물 미배정
  if (!dormitory) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-orange-50 border border-orange-200 rounded-2xl p-4 keep-all"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-orange-900 mb-1">건물이 아직 배정되지 않았어요</h3>
            <p className="text-sm text-orange-700 leading-relaxed mb-3">
              건물이 배정되면 같은 건물 사용자를 확인하고 매칭을 시작할 수 있어요.
            </p>
            <motion.button
              onClick={onNavigateProfile}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <span>배정 건물 등록하기</span>
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  }

  // 2. 소수 유저 (3명 이하)
  if (isLowCount) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-blue-50 border border-blue-200 rounded-2xl p-4 keep-all"
      >
        {/* 건물 정보 헤더 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-blue-600" />
            </div>
            <span className="font-bold text-blue-900">
              {dormitory.name} · {dormitory.roomType}인실
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-blue-600 font-medium">매칭 가능</span>
            <span className="text-lg font-bold text-orange-600">{matchableCount}명</span>
          </div>
        </div>

        {/* 안내 메시지 */}
        <div className="bg-white/60 rounded-xl p-3 mb-3">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800 leading-relaxed">
              같은 건물에 사용자가 적어요. 친구에게 서비스를 알려보세요!
            </p>
          </div>
        </div>

        {/* 공유 버튼 */}
        <motion.button
          onClick={handleShare}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <Share2 className="w-4 h-4" />
          <span>공유하기</span>
        </motion.button>
      </motion.div>
    );
  }

  // 3. 정상 상태 (충분한 유저)
  return (
    <motion.button
      onClick={onNavigateList}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className="w-full bg-[var(--knu-background-alt)] hover:bg-gray-100 rounded-2xl p-4 transition-colors keep-all"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 bg-gradient-to-br from-[var(--knu-primary)] to-blue-700 rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <div className="font-bold text-[var(--knu-text-primary)]">
              {dormitory.name} · {dormitory.roomType}인실
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-xs text-[var(--knu-text-tertiary)] mb-0.5">매칭 가능</div>
            <div className="text-2xl font-bold text-[var(--knu-primary)]">
              {matchableCount}
              <span className="text-sm font-medium text-[var(--knu-text-secondary)] ml-0.5">
                명
              </span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
        </div>
      </div>
    </motion.button>
  );
}

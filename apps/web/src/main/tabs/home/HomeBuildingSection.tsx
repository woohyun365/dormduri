'use client';

import { motion } from 'motion/react';
import {
  Building2,
  AlertTriangle,
  Info,
  Share2,
  ChevronRight,
  Sparkles,
  TrendingUp,
  Link2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { TabId } from '@/types/profile';

interface HomeBuildingSectionProps {
  hasBuilding: boolean;
  buildingName?: string;
  roomType?: string;
  totalParticipants?: number;
  todayNewTotal?: number;
  buildingParticipants?: number;
  todayNewBuilding?: number;
  matchSuccessCount?: number;
  onRegisterBuilding: () => void;
  onBuildingClick?: () => void;
}

export function HomeBuildingSection({
  hasBuilding,
  buildingName,
  roomType,
  totalParticipants = 0,
  todayNewTotal = 0,
  buildingParticipants = 0,
  todayNewBuilding = 0,
  matchSuccessCount = 0,
  onRegisterBuilding,
  onBuildingClick,
}: HomeBuildingSectionProps) {
  const isLowCount = hasBuilding && buildingParticipants <= 5;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      toast.success('링크가 복사되었어요!');
    } catch {
      toast.error('복사에 실패했어요');
    }
  };

  // 1. 건물 미배정
  if (!hasBuilding) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-4 keep-all"
      >
        {/* 건물 미배정 헤더 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-gray-400" />
          </div>
          <h3 className="font-bold text-[var(--knu-text-primary)]">건물 미배정</h3>
        </div>

        {/* 통계 (전체만, 내 건물 비활성) */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-[var(--knu-background-alt)] rounded-xl p-3">
            <p className="text-xs text-[var(--knu-text-tertiary)] mb-1">전체 참여</p>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-[var(--knu-text-primary)]">
                {totalParticipants}명
              </span>
              {todayNewTotal > 0 && (
                <span className="text-xs font-medium text-green-600">+{todayNewTotal}</span>
              )}
            </div>
          </div>
          <div className="bg-[var(--knu-background-alt)] rounded-xl p-3 opacity-40">
            <p className="text-xs text-[var(--knu-text-tertiary)] mb-1">내 건물</p>
            <span className="text-lg font-bold text-[var(--knu-text-tertiary)]">-명</span>
          </div>
        </div>

        {/* 안내 */}
        <p className="text-sm text-[var(--knu-text-secondary)] mb-3 text-center">
          건물이 배정되면 같은 건물 사용자를 확인하고 매칭을 시작할 수 있어요
        </p>

        <motion.button
          onClick={onRegisterBuilding}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full bg-[var(--knu-primary)] hover:bg-[var(--knu-primary-hover)] text-white font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <span>배정 건물 등록하기</span>
          <ChevronRight className="w-4 h-4" />
        </motion.button>
      </motion.div>
    );
  }

  // 2. 소수 참여자 (5명 이하)
  if (isLowCount) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-4 keep-all"
      >
        {/* 건물 헤더 */}
        <button
          onClick={onBuildingClick}
          className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-gradient-to-br from-[var(--knu-primary)] to-blue-700 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-[var(--knu-text-primary)]">
              {buildingName} · {roomType}
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
        </button>

        {/* 통계 (내 건물 강조) */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-[var(--knu-background-alt)] rounded-xl p-3">
            <p className="text-xs text-[var(--knu-text-tertiary)] mb-1">전체 참여</p>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-[var(--knu-text-primary)]">
                {totalParticipants}명
              </span>
              {todayNewTotal > 0 && (
                <span className="text-xs font-medium text-green-600">+{todayNewTotal}</span>
              )}
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-xs text-blue-600 mb-1">내 건물</p>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-blue-600">{buildingParticipants}명</span>
              {todayNewBuilding > 0 && (
                <span className="text-xs font-medium text-green-600">+{todayNewBuilding}</span>
              )}
            </div>
          </div>
        </div>

        {/* 공유 섹션 */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <p className="text-sm text-blue-800 mb-2">
            주변에 룸메를 구하는 친구가 있다면 함께 이용해보세요!
          </p>
          <motion.button
            onClick={handleCopyLink}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-[var(--knu-primary)] hover:bg-[var(--knu-primary-hover)] text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <Link2 className="w-4 h-4" />
            <span>링크 복사</span>
          </motion.button>
        </div>
      </motion.div>
    );
  }

  // 3. 정상 상태
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-4 keep-all"
    >
      {/* 건물 헤더 */}
      <button
        onClick={onBuildingClick}
        className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 bg-gradient-to-br from-[var(--knu-primary)] to-blue-700 rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-[var(--knu-text-primary)]">
            {buildingName} · {roomType}
          </span>
        </div>
        <ChevronRight className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
      </button>

      {/* 통계 */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-[var(--knu-background-alt)] rounded-xl p-3">
          <p className="text-xs text-[var(--knu-text-tertiary)] mb-1">전체 참여</p>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-[var(--knu-text-primary)]">
              {totalParticipants}명
            </span>
            {todayNewTotal > 0 && (
              <motion.span
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-xs font-medium text-green-600"
              >
                +{todayNewTotal}
              </motion.span>
            )}
          </div>
        </div>
        <div className="bg-[var(--knu-background-alt)] rounded-xl p-3">
          <p className="text-xs text-[var(--knu-text-tertiary)] mb-1">내 건물</p>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-[var(--knu-primary)]">
              {buildingParticipants}명
            </span>
            {todayNewBuilding > 0 && (
              <span className="text-xs font-medium text-green-600">+{todayNewBuilding}</span>
            )}
          </div>
        </div>
      </div>

      {/* 매칭 성공 배너 */}
      {matchSuccessCount > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-3 mb-4"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
            <p className="text-sm font-medium text-purple-800">
              이번 시즌 {matchSuccessCount}명이 매칭에 성공했어요!
            </p>
          </div>
        </motion.div>
      )}

      {/* 공유 섹션 */}
      <div className="border-t border-[var(--knu-border)] pt-3 flex items-center justify-between">
        <p className="text-xs text-[var(--knu-text-tertiary)]">
          주변에 룸메를 구하는 친구가 있다면 함께 이용해보세요!
        </p>
        <motion.button
          onClick={handleCopyLink}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-1 text-xs font-medium text-[var(--knu-text-secondary)] hover:text-[var(--knu-primary)] transition-colors flex-shrink-0 ml-2"
        >
          <Link2 className="w-3.5 h-3.5" />
          <span>링크 복사</span>
        </motion.button>
      </div>
    </motion.div>
  );
}

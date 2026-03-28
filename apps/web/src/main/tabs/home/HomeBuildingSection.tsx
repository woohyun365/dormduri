'use client';

import { motion } from 'motion/react';
import { Building2, ChevronRight, Sparkles } from 'lucide-react';
import { ShareLinkSection } from './ShareLinkSection';

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

  // 1. 건물 미배정
  if (!hasBuilding) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border-2 border-[var(--knu-border)] overflow-hidden keep-all"
      >
        {/* 제목 */}
        <div className="flex items-center justify-between p-4 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-gray-400" />
            </div>
            <div className="text-left">
              <span className="font-bold text-[var(--knu-text-secondary)]">건물 미배정</span>
            </div>
          </div>
        </div>

        {/* 통계 그리드 */}
        <div className="grid grid-cols-2 gap-3 px-4 pb-3">
          <div className="bg-[var(--knu-background-alt)] rounded-xl p-3">
            <div className="text-xs text-[var(--knu-text-tertiary)] mb-1">전체 참여</div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-[var(--knu-text-primary)]">
                {totalParticipants}
              </span>
              <span className="text-sm text-[var(--knu-text-secondary)]">명</span>
              {todayNewTotal > 0 && (
                <span className="text-xs font-bold text-green-600 ml-1">(+{todayNewTotal})</span>
              )}
            </div>
          </div>

          <div className="bg-[var(--knu-background-alt)] rounded-xl p-3 opacity-40">
            <div className="text-xs text-[var(--knu-text-tertiary)] mb-1">내 건물</div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-[var(--knu-text-primary)]">-</span>
              <span className="text-sm text-[var(--knu-text-secondary)]">명</span>
            </div>
          </div>
        </div>

        {/* 건물 배정 안내 */}
        <div className="px-4 pb-3">
          <p className="text-sm text-[var(--knu-text-secondary)] leading-relaxed mb-3">
            건물이 배정되면 같은 건물 사용자를 확인하고 매칭을 시작할 수 있어요.
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
        </div>

        <ShareLinkSection />
      </motion.div>
    );
  }

  // 2. 소수 참여자 (5명 이하) - 공유 강조
  if (isLowCount) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border-2 border-[var(--knu-border)] overflow-hidden keep-all"
      >
        {/* 건물 정보 헤더 */}
        <button
          onClick={onBuildingClick}
          className="w-full flex items-center justify-between p-4 pb-3 hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-gradient-to-br from-[var(--knu-primary)] to-blue-700 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <span className="font-bold text-[var(--knu-text-primary)]">
                {buildingName} · {roomType}
              </span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
        </button>

        {/* 통계 그리드 */}
        <div className="grid grid-cols-2 gap-3 px-4 pb-3">
          <div className="bg-[var(--knu-background-alt)] rounded-xl p-3">
            <div className="text-xs text-[var(--knu-text-tertiary)] mb-1">전체 참여</div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-[var(--knu-text-primary)]">
                {totalParticipants}
              </span>
              <span className="text-sm text-[var(--knu-text-secondary)]">명</span>
              {todayNewTotal > 0 && (
                <span className="text-xs font-bold text-green-600 ml-1">(+{todayNewTotal})</span>
              )}
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
            <div className="text-xs text-blue-600 mb-1 font-medium">{buildingName} 참여</div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-blue-600">{buildingParticipants}</span>
              <span className="text-sm text-blue-600">명</span>
              {todayNewBuilding > 0 && (
                <span className="text-xs font-bold text-green-600 ml-1">(+{todayNewBuilding})</span>
              )}
            </div>
          </div>
        </div>

        <ShareLinkSection variant="emphasis" />
      </motion.div>
    );
  }

  // 3. 정상 상태 (참여자 충분)
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border-2 border-[var(--knu-border)] overflow-hidden keep-all"
    >
      {/* 건물 정보 헤더 */}
      <button
        onClick={onBuildingClick}
        className="w-full flex items-center justify-between p-4 pb-3 hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 bg-gradient-to-br from-[var(--knu-primary)] to-blue-700 rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <span className="font-bold text-[var(--knu-text-primary)]">
              {buildingName} · {roomType}
            </span>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
      </button>

      {/* 통계 그리드 */}
      <div className="grid grid-cols-2 gap-3 px-4 pb-3">
        <div className="bg-[var(--knu-background-alt)] rounded-xl p-3">
          <div className="text-xs text-[var(--knu-text-tertiary)] mb-1">전체 참여</div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-[var(--knu-text-primary)]">
              {totalParticipants}
            </span>
            <span className="text-sm text-[var(--knu-text-secondary)]">명</span>
            {todayNewTotal > 0 && (
              <motion.span
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-xs font-bold text-green-600 ml-1"
              >
                (+{todayNewTotal})
              </motion.span>
            )}
          </div>
        </div>

        <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
          <div className="text-xs text-blue-600 mb-1 font-medium">{buildingName} 참여</div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-blue-600">{buildingParticipants}</span>
            <span className="text-sm text-blue-600">명</span>
            {todayNewBuilding > 0 && (
              <span className="text-xs font-bold text-green-600 ml-1">(+{todayNewBuilding})</span>
            )}
          </div>
        </div>
      </div>

      {/* 매칭 성공 배너 (0이면 숨김) */}
      {matchSuccessCount > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mx-4 mb-3 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-3"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
            <p className="text-sm font-medium text-purple-900">
              이번 시즌 <span className="font-bold">{matchSuccessCount}명</span>이 매칭에
              성공했어요!
            </p>
          </div>
        </motion.div>
      )}

      <ShareLinkSection />
    </motion.div>
  );
}

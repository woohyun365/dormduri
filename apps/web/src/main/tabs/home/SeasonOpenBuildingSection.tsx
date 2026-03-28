'use client';

import { motion } from 'motion/react';
import { Clock, Users, Eye, ChevronRight } from 'lucide-react';
import { ShareLinkSection } from './ShareLinkSection';

interface SeasonOpenBuildingSectionProps {
  hasBuilding: boolean;
  buildingName?: string;
  roomType?: string;
  daysUntilStart: number;
  seasonStartDate: string;
  waitingTotal: number;
  todayNewTotal?: number;
  waitingBuilding?: number;
  onRegisterBuilding: () => void;
  onPreviewClick?: () => void;
}

export function SeasonOpenBuildingSection({
  hasBuilding,
  buildingName,
  roomType,
  daysUntilStart,
  seasonStartDate,
  waitingTotal,
  todayNewTotal = 0,
  waitingBuilding = 0,
  onRegisterBuilding,
  onPreviewClick,
}: SeasonOpenBuildingSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border-2 border-[var(--knu-border)] overflow-hidden keep-all"
    >
      {/* 제목 */}
      <div className="flex items-center justify-between p-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-10 h-10 ${hasBuilding ? 'bg-gradient-to-br from-[var(--knu-primary)] to-blue-700' : 'bg-gray-100'} rounded-xl flex items-center justify-center`}
          >
            <Clock className={`w-5 h-5 ${hasBuilding ? 'text-white' : 'text-gray-400'}`} />
          </div>
          <div className="text-left">
            <span className="font-bold text-[var(--knu-text-primary)]">다음 시즌 참여 현황</span>
            <p className="text-xs text-[var(--knu-text-tertiary)]">
              {seasonStartDate} 시작 · D-{daysUntilStart}
            </p>
          </div>
        </div>
      </div>

      {/* 건물 미입력 시 - 경고 카드 */}
      {!hasBuilding && (
        <div className="px-4 pb-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">⚠️</span>
              <span className="font-bold text-amber-900">건물 정보 미입력</span>
            </div>
            <p className="text-sm text-amber-800 leading-relaxed">
              건물을 입력하면 같은 건물 대기자를 확인할 수 있어요
            </p>
          </div>
        </div>
      )}

      {/* 건물 입력 완료 */}
      {hasBuilding && (
        <div className="px-4 pb-3">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-green-600" />
              <span className="font-bold text-green-700">
                {buildingName} · {roomType}
              </span>
            </div>
            <p className="text-sm text-green-800">✅ 시즌 준비 완료!</p>
          </div>
        </div>
      )}

      {/* 대기자 통계 */}
      <div className="grid grid-cols-2 gap-3 px-4 pb-3">
        <div className="bg-[var(--knu-background-alt)] rounded-xl p-3">
          <div className="text-xs text-[var(--knu-text-tertiary)] mb-1">전체 대기</div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-[var(--knu-text-primary)]">
              {waitingTotal}
            </span>
            <span className="text-sm text-[var(--knu-text-secondary)]">명</span>
            {todayNewTotal > 0 && (
              <span className="text-xs font-bold text-green-600 ml-1">(+{todayNewTotal})</span>
            )}
          </div>
        </div>

        <div
          className={`rounded-xl p-3 ${hasBuilding ? 'bg-blue-50 border border-blue-200' : 'bg-[var(--knu-background-alt)] opacity-40'}`}
        >
          <div
            className={`text-xs mb-1 ${hasBuilding ? 'text-blue-600 font-medium' : 'text-[var(--knu-text-tertiary)]'}`}
          >
            {hasBuilding ? `${buildingName} 대기` : '내 건물'}
          </div>
          <div className="flex items-baseline gap-1">
            <span
              className={`text-2xl font-bold ${hasBuilding ? 'text-blue-600' : 'text-[var(--knu-text-primary)]'}`}
            >
              {hasBuilding ? waitingBuilding : '-'}
            </span>
            <span
              className={`text-sm ${hasBuilding ? 'text-blue-600' : 'text-[var(--knu-text-secondary)]'}`}
            >
              명
            </span>
          </div>
        </div>
      </div>

      {/* CTA */}
      {!hasBuilding ? (
        <div className="px-4 pb-3">
          <motion.button
            onClick={onRegisterBuilding}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-[var(--knu-primary)] hover:bg-[var(--knu-primary-hover)] text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <span>건물 입력하기</span>
            <ChevronRight className="w-4 h-4" />
          </motion.button>
        </div>
      ) : (
        onPreviewClick && (
          <div className="px-4 pb-3">
            <motion.button
              onClick={onPreviewClick}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full bg-[var(--knu-background-alt)] hover:bg-gray-100 border border-[var(--knu-border)] text-[var(--knu-text-primary)] font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" />
              <span>같은 건물 참여자 미리보기</span>
            </motion.button>
          </div>
        )
      )}

      {/* 공유 섹션 */}
      <ShareLinkSection />
    </motion.div>
  );
}

'use client';

import { motion } from 'motion/react';
import { History } from 'lucide-react';
import { ShareLinkSection } from './ShareLinkSection';

interface OffSeasonBuildingSectionProps {
  hasBuilding: boolean;
  buildingName?: string;
  roomType?: string;
  pastSeasonName: string;
  pastTotalParticipants: number;
  pastBuildingParticipants: number;
  pastMatchSuccessCount: number;
  nextSeasonDate: string;
  onViewDetails?: () => void;
}

export function OffSeasonBuildingSection({
  hasBuilding,
  buildingName,
  roomType,
  pastSeasonName,
  pastTotalParticipants,
  pastBuildingParticipants,
  pastMatchSuccessCount,
  nextSeasonDate,
  onViewDetails,
}: OffSeasonBuildingSectionProps) {
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
            <History className={`w-5 h-5 ${hasBuilding ? 'text-white' : 'text-gray-400'}`} />
          </div>
          <div className="text-left">
            <span className="font-bold text-[var(--knu-text-primary)]">{pastSeasonName} 결과</span>
            {hasBuilding && (
              <p className="text-xs text-[var(--knu-text-tertiary)]">
                {buildingName} · {roomType}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 통계 그리드 */}
      <div className="grid grid-cols-2 gap-3 px-4 pb-3">
        <div className="bg-[var(--knu-background-alt)] rounded-xl p-3">
          <div className="text-xs text-[var(--knu-text-tertiary)] mb-1">전체 참여</div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-[var(--knu-text-primary)]">
              {pastTotalParticipants}
            </span>
            <span className="text-sm text-[var(--knu-text-secondary)]">명</span>
          </div>
        </div>

        <div
          className={`rounded-xl p-3 ${hasBuilding ? 'bg-[var(--knu-background-alt)]' : 'bg-[var(--knu-background-alt)] opacity-40'}`}
        >
          <div className="text-xs text-[var(--knu-text-tertiary)] mb-1">
            {hasBuilding ? buildingName : '내 건물'}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-[var(--knu-text-primary)]">
              {hasBuilding ? pastBuildingParticipants : '-'}
            </span>
            <span className="text-sm text-[var(--knu-text-secondary)]">명</span>
          </div>
        </div>
      </div>

      {/* 매칭 성공 */}
      {pastMatchSuccessCount > 0 && (
        <div className="mx-4 mb-3 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-3">
          <p className="text-sm font-medium text-purple-900 text-center">
            🎉 <span className="font-bold">{pastMatchSuccessCount}명</span>이 매칭에 성공했어요
          </p>
        </div>
      )}

      {/* 다음 시즌 안내 */}
      <div className="border-t border-[var(--knu-border)] p-4 bg-blue-50">
        {nextSeasonDate && (
          <p className="text-sm text-[var(--knu-text-secondary)] text-center mb-2">
            📅 다음 시즌: {nextSeasonDate} 시작
          </p>
        )}
        {onViewDetails && (
          <motion.button
            onClick={onViewDetails}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full bg-white hover:bg-gray-50 border border-[var(--knu-border)] text-[var(--knu-text-primary)] font-medium py-2 px-4 rounded-xl transition-colors text-sm"
          >
            이번 시즌 상세 보기
          </motion.button>
        )}
      </div>

      {/* 공유 섹션 */}
      <ShareLinkSection />
    </motion.div>
  );
}

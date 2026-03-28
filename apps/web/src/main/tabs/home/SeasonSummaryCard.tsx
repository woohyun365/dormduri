'use client';

import { motion } from 'motion/react';
import {
  Calendar,
  CheckCircle,
  XCircle,
  BarChart3,
  Send,
  Inbox,
  MessageCircle,
  ChevronRight,
  TrendingUp,
  ListX,
} from 'lucide-react';
import { ProfileManagementCard } from './ProfileManagementCard';

interface PastSeasonResult {
  matched: boolean;
  partnerName?: string;
  totalRequests: number;
  sentRequests: number;
  totalChats: number;
}

interface SeasonSummaryCardProps {
  pastSeasonName: string;
  daysUntilNext: number;
  nextSeasonDate: string;
  nextSeasonName: string;
  pastSeasonResult?: PastSeasonResult;
  hasRegisteredNext: boolean;
  onViewHistory?: () => void;
  onUpdateProfile?: () => void;
  missingFields?: string[];
}

export function SeasonSummaryCard({
  pastSeasonName,
  daysUntilNext,
  nextSeasonDate,
  nextSeasonName,
  pastSeasonResult,
  hasRegisteredNext,
  onViewHistory,
  onUpdateProfile,
  missingFields,
}: SeasonSummaryCardProps) {
  const hasParticipated = !!pastSeasonResult;
  const hasNextSeason = daysUntilNext > 0 && nextSeasonDate !== '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-5 keep-all"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-[var(--knu-text-primary)]">매칭 활동</h2>
        <TrendingUp className="w-5 h-5 text-[var(--knu-primary)]" />
      </div>

      {/* 다음 시즌 카운트다운 (등록된 경우만) */}
      {hasNextSeason && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--knu-text-tertiary)]">다음 시즌까지</p>
              <p className="text-2xl font-bold text-blue-600">{daysUntilNext}일</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
              {nextSeasonName}
            </span>
            <p className="text-sm text-[var(--knu-text-secondary)]">{nextSeasonDate}</p>
          </div>
        </div>
      )}

      {/* 지난 시즌 결과 */}
      {hasParticipated && pastSeasonResult && (
        <div className="mb-4">
          <h3 className="text-sm font-bold text-[var(--knu-text-primary)] mb-3 flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--knu-primary)] bg-blue-50 px-2 py-0.5 rounded-full">
              이전 시즌
            </span>
            {pastSeasonName} 결과
          </h3>

          {pastSeasonResult.matched ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-bold text-green-700">매칭 성공</span>
              </div>
              <p className="text-sm text-green-800">
                <span className="font-bold">{pastSeasonResult.partnerName}</span>님과 매칭되었어요
              </p>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-5 h-5 text-gray-500" />
                <span className="font-bold text-gray-700">매칭 미성사</span>
              </div>
              <p className="text-sm text-gray-600">아쉽게도 매칭이 성사되지 않았어요</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-[var(--knu-background-alt)] rounded-xl p-3 text-center">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Inbox className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-lg font-bold text-purple-600">{pastSeasonResult.totalRequests}</p>
              <p className="text-xs text-[var(--knu-text-tertiary)]">받은 요청</p>
            </div>
            <div className="bg-[var(--knu-background-alt)] rounded-xl p-3 text-center">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Send className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-lg font-bold text-blue-600">{pastSeasonResult.sentRequests}</p>
              <p className="text-xs text-[var(--knu-text-tertiary)]">보낸 요청</p>
            </div>
            <div className="bg-[var(--knu-background-alt)] rounded-xl p-3 text-center">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <MessageCircle className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-lg font-bold text-green-600">{pastSeasonResult.totalChats}</p>
              <p className="text-xs text-[var(--knu-text-tertiary)]">대화</p>
            </div>
          </div>

          {/* 지난 시즌 상세 보기 */}
          {onViewHistory && (
            <motion.button
              onClick={onViewHistory}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full bg-[var(--knu-background-alt)] hover:bg-gray-100 border border-[var(--knu-border)] text-[var(--knu-text-primary)] font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              <span>이전 시즌 상세 보기</span>
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      )}

      {!hasParticipated && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 flex items-center gap-3">
          <ListX className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <p className="text-sm text-[var(--knu-text-secondary)]">
            이전 시즌에는 참여 기록이 없어요.
          </p>
        </div>
      )}
    </motion.div>
  );
}

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
  Bell,
  TrendingUp,
} from 'lucide-react';
import type { TabId } from '@/types/profile';

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
  onRegisterNext?: () => void;
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
  onRegisterNext,
}: SeasonSummaryCardProps) {
  const hasParticipated = !!pastSeasonResult;

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

      {/* 다음 시즌 카운트다운 */}
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
        <p className="text-sm text-[var(--knu-text-secondary)]">
          {nextSeasonDate} · {nextSeasonName}
        </p>
      </div>

      {/* 지난 시즌 결과 */}
      {hasParticipated && pastSeasonResult && (
        <div className="mb-4">
          <h3 className="text-sm font-bold text-[var(--knu-text-primary)] mb-3">
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

          {onViewHistory && (
            <motion.button
              onClick={onViewHistory}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full bg-[var(--knu-background-alt)] hover:bg-gray-100 border border-[var(--knu-border)] text-[var(--knu-text-primary)] font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              <span>이번 시즌 상세 보기</span>
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      )}

      {!hasParticipated && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 text-center">
          <p className="text-sm text-[var(--knu-text-secondary)]">
            지난 시즌에는 참여하지 않으셨어요
          </p>
        </div>
      )}

      {/* 다음 시즌 준비 */}
      <div className="border-t border-[var(--knu-border)] pt-4">
        <h3 className="text-sm font-bold text-[var(--knu-text-primary)] mb-3">다음 시즌 준비</h3>

        {hasRegisteredNext ? (
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-bold text-green-700">다음 시즌 등록 완료</span>
              </div>
              <p className="text-sm text-green-800">시즌 시작 1시간 전에 알림을 보내드릴게요</p>
            </div>

            {hasParticipated &&
              pastSeasonResult &&
              !pastSeasonResult.matched &&
              onUpdateProfile && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm text-amber-800 mb-3">프로필을 보완하면 매칭률이 높아져요</p>
                  <motion.button
                    onClick={onUpdateProfile}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <span>프로필 미리 업데이트</span>
                    <ChevronRight className="w-4 h-4" />
                  </motion.button>
                </div>
              )}

            {(!hasParticipated || (pastSeasonResult && pastSeasonResult.matched)) &&
              onUpdateProfile && (
                <motion.button
                  onClick={onUpdateProfile}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full bg-[var(--knu-background-alt)] hover:bg-gray-100 border border-[var(--knu-border)] text-[var(--knu-text-primary)] font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <span>프로필 미리 업데이트</span>
                  <ChevronRight className="w-4 h-4" />
                </motion.button>
              )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[var(--knu-text-secondary)] leading-relaxed">
              다음 시즌에도 참여하시나요? 미리 등록하고 알림을 받아보세요
            </p>

            {onRegisterNext && (
              <motion.button
                onClick={onRegisterNext}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-[var(--knu-primary)] hover:bg-[var(--knu-primary-hover)] text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Bell className="w-4 h-4" />
                <span>다음 시즌 알림 받기</span>
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            )}

            {hasParticipated &&
              pastSeasonResult &&
              !pastSeasonResult.matched &&
              onUpdateProfile && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm text-amber-800 mb-3">
                    프로필을 보완하면 다음 시즌 매칭률이 높아져요
                  </p>
                  <motion.button
                    onClick={onUpdateProfile}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <span>프로필 업데이트</span>
                    <ChevronRight className="w-4 h-4" />
                  </motion.button>
                </div>
              )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

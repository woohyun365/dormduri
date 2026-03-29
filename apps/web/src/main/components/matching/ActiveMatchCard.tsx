'use client';

import { motion } from 'motion/react';
import { Handshake, User, MessageCircle, AlertTriangle } from 'lucide-react';
import { getAvatarColor } from '@/utils/avatarColor';
import { getDormitoryLabel } from '@/utils/dormitoryLabel';
import { MatchingBadge } from './MatchingBadge';
import type { MatchScoreType } from '@/types/match';

interface ActiveMatchCardProps {
  nickname: string;
  dormitoryId: string | null;
  matchScore: number;
  scoreType: MatchScoreType;
  onViewProfile: () => void;
  onRelease: () => void;
}

export function ActiveMatchCard({
  nickname,
  dormitoryId,
  matchScore,
  scoreType,
  onViewProfile,
  onRelease,
}: ActiveMatchCardProps) {
  const avatarColor = getAvatarColor(nickname);
  const dormLabel = getDormitoryLabel(dormitoryId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* 확정 배너 */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-5 text-white relative overflow-hidden">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 20, ease: 'linear' }}
          className="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full"
        />
        <div className="relative flex items-start gap-3">
          <Handshake className="w-6 h-6 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-lg mb-0.5">🎉 매칭이 확정되었습니다!</p>
            <p className="text-sm opacity-90">호실 선택은 학교 시스템에서 진행해 주세요</p>
          </div>
        </div>
      </div>

      {/* 파트너 카드 */}
      <div className="bg-white rounded-2xl border-2 border-green-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className={`w-16 h-16 ${avatarColor.bg} rounded-full flex items-center justify-center text-xl font-bold ${avatarColor.text} flex-shrink-0`}
            >
              {nickname.charAt(0)}
            </div>
            <div>
              <h3 className="text-xl font-bold text-[var(--knu-text-primary)] mb-1">{nickname}</h3>
              <p className="text-sm text-[var(--knu-text-tertiary)]">{dormLabel}</p>
            </div>
          </div>
          <MatchingBadge
            score={matchScore}
            gated={scoreType === 'gated'}
            partial={scoreType === 'partial'}
            size="lg"
          />
        </div>

        <div className="space-y-2.5">
          <button
            disabled
            className="w-full py-3 bg-gray-100 text-gray-400 rounded-xl font-medium cursor-not-allowed flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            대화 (준비 중)
          </button>

          <motion.button
            onClick={onViewProfile}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full py-3 bg-[var(--knu-background-alt)] border-2 border-[var(--knu-border)] rounded-xl font-medium text-[var(--knu-text-primary)] hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
          >
            <User className="w-4 h-4" />
            프로필 보기
          </motion.button>

          <motion.button
            onClick={onRelease}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full py-2.5 text-red-600 font-medium hover:bg-red-50 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" />
            매칭 해제
          </motion.button>
        </div>
      </div>

      {/* 안내 */}
      <div className="bg-blue-50/80 backdrop-blur-md border border-blue-200/60 rounded-xl p-4">
        <p className="text-sm text-blue-800 flex items-start gap-2">
          <span className="text-lg flex-shrink-0">💡</span>
          <span>호실 선택은 학교 기숙사 시스템에서 직접 진행해 주세요</span>
        </p>
      </div>
    </motion.div>
  );
}

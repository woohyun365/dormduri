'use client';

import { motion } from 'motion/react';
import { MessageCircle, User, Check, X } from 'lucide-react';
import { getAvatarColor } from '@/utils/avatarColor';
import { getDormitoryLabel } from '@/utils/dormitoryLabel';
import { MatchingBadge } from './MatchingBadge';
import type { MatchScoreType } from '@/types/match';

interface ConversationCardProps {
  nickname: string;
  dormitoryId: string | null;
  matchScore: number;
  scoreType: MatchScoreType;
  onViewProfile: () => void;
  onConfirm: () => void;
  onEnd: () => void;
}

export function ConversationCard({
  nickname,
  dormitoryId,
  matchScore,
  scoreType,
  onViewProfile,
  onConfirm,
  onEnd,
}: ConversationCardProps) {
  const avatarColor = getAvatarColor(nickname);
  const dormLabel = getDormitoryLabel(dormitoryId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border-2 border-blue-200 p-5 relative overflow-hidden"
    >
      {/* 상단 gradient line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />

      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span className="text-xs font-bold text-green-600">대화 진행 중</span>
      </div>

      {/* 헤더: 아바타 + 닉네임 + 매칭도 */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3 flex-1">
          <div
            className={`w-12 h-12 ${avatarColor.bg} rounded-full flex items-center justify-center text-base font-bold ${avatarColor.text} flex-shrink-0`}
          >
            {nickname.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[var(--knu-text-primary)] mb-0.5 truncate">{nickname}</h3>
            <p className="text-sm text-[var(--knu-text-tertiary)]">{dormLabel}</p>
          </div>
        </div>
        <MatchingBadge
          score={matchScore}
          gated={scoreType === 'gated'}
          partial={scoreType === 'partial'}
        />
      </div>

      {/* 버튼 그룹 (2x2 그리드) */}
      <div className="grid grid-cols-2 gap-2">
        <motion.button
          onClick={onViewProfile}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="py-2.5 bg-[var(--knu-background-alt)] border border-[var(--knu-border)] text-[var(--knu-text-primary)] font-medium rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-1.5"
        >
          <User className="w-4 h-4" />
          <span className="text-sm">프로필</span>
        </motion.button>

        <button
          disabled
          className="py-2.5 bg-gray-100 text-gray-400 font-medium rounded-xl cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          <MessageCircle className="w-4 h-4" />
          <span className="text-sm">대화</span>
        </button>

        <motion.button
          onClick={onConfirm}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="col-span-2 py-3 bg-gradient-to-r from-[var(--knu-primary)] to-blue-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-blue-800 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
        >
          <Check className="w-5 h-5" />
          매칭 확정
        </motion.button>

        <motion.button
          onClick={onEnd}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="col-span-2 py-2 text-red-600 font-medium hover:bg-red-50 rounded-xl transition-colors flex items-center justify-center gap-1.5"
        >
          <X className="w-4 h-4" />
          <span className="text-sm">대화 종료</span>
        </motion.button>
      </div>
    </motion.div>
  );
}

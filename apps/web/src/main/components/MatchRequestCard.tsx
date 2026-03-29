'use client';

import { motion } from 'motion/react';
import { Clock, Sparkles } from 'lucide-react';
import { getAvatarColor } from '@/utils/avatarColor';
import { getDormitoryLabel } from '@/utils/dormitoryLabel';
import { useExpiryCountdown } from '@/hooks/useExpiryCountdown';
import { MatchingBadge } from './matching/MatchingBadge';
import type { MatchRequest, MatchScoreType } from '@/types/match';
import type { RoommateProfile } from '@/types/profile';

interface MatchRequestCardProps {
  request: MatchRequest;
  direction: 'sent' | 'received';
  partnerProfile: Omit<RoommateProfile, 'matchScore'> & { matchScore: number };
  scoreType?: MatchScoreType;
  isNew?: boolean;
  onCancel?: (requestId: string) => void;
  onAccept?: (requestId: string) => void;
  onReject?: (requestId: string) => void;
  onClick?: () => void;
}

export function MatchRequestCard({
  request,
  direction,
  partnerProfile,
  scoreType = 'full',
  isNew,
  onCancel,
  onAccept,
  onReject,
  onClick,
}: MatchRequestCardProps) {
  const { timeLeft, isExpired, totalSeconds } = useExpiryCountdown(request.expiresAt);
  const isUrgent = !isExpired && totalSeconds <= 24 * 60 * 60;
  const avatarColor = getAvatarColor(partnerProfile.nickname);
  const dormLabel = getDormitoryLabel(partnerProfile.dormitoryId);
  const isRecommended = partnerProfile.matchScore >= 85 && direction === 'received';
  const isSent = direction === 'sent';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`bg-white rounded-2xl border-2 p-5 transition-all ${
        onClick ? 'cursor-pointer hover:shadow-lg' : ''
      } ${
        isRecommended
          ? 'border-purple-300 shadow-md shadow-purple-100'
          : 'border-[var(--knu-border)]'
      }`}
    >
      {/* 추천 뱃지 (85%+ 받은 요청만) */}
      {isRecommended && (
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded-full mb-3"
        >
          <Sparkles className="w-3 h-3" />
          추천 매칭
        </motion.div>
      )}

      {/* New 라벨 (받은 요청 미확인 건) */}
      {isNew && !isSent && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="inline-flex items-center px-2.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full mb-3 ml-2"
        >
          New
        </motion.div>
      )}

      {/* Header: 아바타 + 닉네임 + 매칭도 뱃지 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 flex-1">
          <div
            className={`w-10 h-10 ${avatarColor.bg} rounded-full flex items-center justify-center text-sm font-bold ${avatarColor.text} flex-shrink-0`}
          >
            {partnerProfile.nickname.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-[var(--knu-text-primary)] mb-0.5">
              {partnerProfile.nickname}
            </h4>
            {dormLabel && <p className="text-sm text-[var(--knu-text-tertiary)]">{dormLabel}</p>}
          </div>
        </div>
        <MatchingBadge
          score={partnerProfile.matchScore}
          gated={scoreType === 'gated'}
          partial={scoreType === 'partial'}
        />
      </div>

      {/* Message */}
      {request.message && (
        <div className="bg-[var(--knu-background-alt)] rounded-xl p-3 mb-3">
          <p className="text-sm text-[var(--knu-text-secondary)] line-clamp-2">
            &ldquo;{request.message}&rdquo;
          </p>
        </div>
      )}

      {/* Timer */}
      <div className="flex items-center justify-between mb-4" suppressHydrationWarning>
        <div
          className={`flex items-center gap-1.5 text-xs font-semibold ${
            isExpired
              ? 'text-red-500'
              : isUrgent
                ? 'text-red-600'
                : 'text-[var(--knu-text-tertiary)]'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span suppressHydrationWarning>
            {isExpired ? '만료됨' : isUrgent ? `만료 임박 ${timeLeft}` : `남은 시간 ${timeLeft}`}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        {isSent ? (
          <motion.button
            onClick={() => onCancel?.(request.id)}
            disabled={isExpired}
            whileHover={isExpired ? undefined : { scale: 1.02 }}
            whileTap={isExpired ? undefined : { scale: 0.98 }}
            className={`flex-1 py-2.5 border-2 font-medium rounded-xl transition-colors ${
              isExpired
                ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                : 'border-[var(--knu-border)] text-[var(--knu-text-secondary)] hover:bg-[var(--knu-background-alt)]'
            }`}
          >
            취소
          </motion.button>
        ) : (
          <>
            <motion.button
              onClick={() => onReject?.(request.id)}
              disabled={isExpired}
              whileHover={isExpired ? undefined : { scale: 1.02 }}
              whileTap={isExpired ? undefined : { scale: 0.98 }}
              className={`flex-1 py-2.5 border-2 font-medium rounded-xl transition-colors ${
                isExpired
                  ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                  : 'border-[var(--knu-border)] text-[var(--knu-text-secondary)] hover:bg-red-50 hover:border-red-200 hover:text-red-600'
              }`}
            >
              거절
            </motion.button>
            <motion.button
              onClick={() => onAccept?.(request.id)}
              disabled={isExpired}
              whileHover={isExpired ? undefined : { scale: 1.02 }}
              whileTap={isExpired ? undefined : { scale: 0.98 }}
              className={`flex-1 py-2.5 font-bold rounded-xl transition-colors ${
                isExpired
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-[var(--knu-primary)] text-white hover:bg-[var(--knu-primary-hover)]'
              }`}
            >
              수락
            </motion.button>
          </>
        )}
      </div>
    </motion.div>
  );
}

'use client';

import { motion } from 'motion/react';
import { Check, MessageCircle, User, X } from 'lucide-react';
import { getAvatarColor } from '@/utils/avatarColor';
import { getDormitoryLabel } from '@/utils/dormitoryLabel';
import { MatchingBadge } from './MatchingBadge';
import {
  matchingBorder,
  matchingCardShell,
  matchingChip,
  matchingPanel,
} from '@/main/styles/matching';
import { getConversationHelperCopy } from './policyCopy';
import type { MatchScoreType } from '@/types/match';

interface ConversationCardProps {
  nickname: string;
  dormitoryId: string | null;
  matchScore: number;
  scoreType: MatchScoreType;
  confirmApprovalCount?: number;
  confirmApprovalTotal?: number;
  viewerConfirmed?: boolean;
  partnerConfirmed?: boolean;
  onViewProfile: () => void;
  onConfirm: () => void;
  onRevokeConfirm: () => void;
  onEnd: () => void;
}

export function ConversationCard({
  nickname,
  dormitoryId,
  matchScore,
  scoreType,
  confirmApprovalCount = 0,
  confirmApprovalTotal = 2,
  viewerConfirmed = false,
  partnerConfirmed = false,
  onViewProfile,
  onConfirm,
  onRevokeConfirm,
  onEnd,
}: ConversationCardProps) {
  const avatarColor = getAvatarColor(nickname);
  const dormLabel = getDormitoryLabel(dormitoryId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${matchingCardShell} ${matchingBorder('cobalt')}`}
    >
      <div className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className={matchingChip('cobalt')}>
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            대화 진행 중
          </span>
          <span className={matchingChip('slate')}>확정 전 단계</span>
        </div>

        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className={`h-12 w-12 ${avatarColor.bg} rounded-full flex items-center justify-center text-base font-bold ${avatarColor.text} flex-shrink-0 ring-4 ring-white`}
            >
              {nickname.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-blue-700">서로를 확인하는 단계예요</p>
              <h3 className="mt-1 truncate text-[1.35rem] font-bold leading-none text-[var(--knu-text-primary)]">
                {nickname}
              </h3>
              <p className="mt-1 text-sm text-[var(--knu-text-tertiary)]">{dormLabel}</p>
            </div>
          </div>
          <MatchingBadge
            score={matchScore}
            gated={scoreType === 'gated'}
            partial={scoreType === 'partial'}
          />
        </div>

        <div className={`${matchingPanel('cobalt')} mb-4`}>
          <p className="text-sm leading-relaxed text-[var(--knu-text-secondary)]">
            {getConversationHelperCopy({
              confirmApprovalCount,
              confirmApprovalTotal,
              viewerConfirmed,
              partnerConfirmed,
            })}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <motion.button
            onClick={onViewProfile}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[var(--knu-text-primary)] transition-colors hover:bg-slate-50"
          >
            <span className="flex items-center justify-center gap-1.5">
              <User className="h-4 w-4" />
              프로필 보기
            </span>
          </motion.button>

          <button
            disabled
            className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-400"
          >
            <span className="flex items-center justify-center gap-1.5">
              <MessageCircle className="h-4 w-4" />
              대화 준비 중
            </span>
          </button>

          <motion.button
            onClick={viewerConfirmed ? onRevokeConfirm : onConfirm}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={`col-span-2 rounded-xl px-4 py-3.5 text-sm font-bold ${
              viewerConfirmed
                ? 'border-2 border-[var(--knu-border)] bg-white text-[var(--knu-text-primary)] hover:bg-[var(--knu-background-alt)]'
                : 'bg-[var(--knu-primary)] text-white hover:bg-[var(--knu-primary-hover)]'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <Check className="h-5 w-5" />
              {viewerConfirmed ? '확정 완료 취소' : '매칭 확정하기'}
            </span>
          </motion.button>

          <motion.button
            onClick={onEnd}
            disabled={viewerConfirmed}
            whileHover={viewerConfirmed ? undefined : { scale: 1.01 }}
            whileTap={viewerConfirmed ? undefined : { scale: 0.99 }}
            className={`col-span-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors ${
              viewerConfirmed
                ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                : 'text-rose-600 hover:bg-rose-50'
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <X className="h-4 w-4" />
              대화 종료
            </span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

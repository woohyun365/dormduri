'use client';

import { motion } from 'motion/react';
import { AlertTriangle, Handshake, MessageCircle, User } from 'lucide-react';
import { getAvatarColor } from '@/utils/avatarColor';
import { getDormitoryLabel } from '@/utils/dormitoryLabel';
import { MatchingBadge } from './MatchingBadge';
import { matchingCardShell, matchingPanel } from '@/main/styles/matching';
import { getActiveMatchHelperCopy } from './policyCopy';
import type { CancelRequestKind, MatchScoreType } from '@/types/match';

interface ActiveMatchCardProps {
  nickname: string;
  dormitoryId: string | null;
  matchScore: number;
  scoreType: MatchScoreType;
  cancelPending?: boolean;
  cancelRequestedByCurrentUser?: boolean;
  cancelRequestKind?: CancelRequestKind | null;
  cancelApprovalCount?: number;
  cancelApprovalTotal?: number;
  onViewProfile: () => void;
  onRelease: () => void;
}

export function ActiveMatchCard({
  nickname,
  dormitoryId,
  matchScore,
  scoreType,
  cancelPending = false,
  cancelRequestedByCurrentUser = false,
  cancelRequestKind = null,
  cancelApprovalCount = 0,
  cancelApprovalTotal = 1,
  onViewProfile,
  onRelease,
}: ActiveMatchCardProps) {
  const avatarColor = getAvatarColor(nickname);
  const dormLabel = getDormitoryLabel(dormitoryId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${matchingCardShell} border-green-200 shadow-sm`}
    >
      <div className="border-b border-green-200 bg-green-50 px-5 py-5">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-green-100 p-3">
            <Handshake className="h-6 w-6 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-green-700">매칭 확정</p>
            <h2 className="mt-1 text-xl font-bold text-[var(--knu-text-primary)]">
              서로의 룸메이트가 되었어요
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--knu-text-secondary)]">
              이제 최종 확정 상태예요. 호실 선택은 학교 시스템에서 직접 진행해 주세요.
            </p>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className={`h-16 w-16 ${avatarColor.bg} rounded-full flex items-center justify-center text-xl font-bold ${avatarColor.text} ring-4 ring-white`}
            >
              {nickname.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-green-700">함께 배정된 룸메이트</p>
              <h3 className="mt-1 truncate text-2xl font-bold text-[var(--knu-text-primary)]">
                {nickname}
              </h3>
              <p className="mt-1 text-sm text-[var(--knu-text-tertiary)]">{dormLabel}</p>
            </div>
          </div>
          <MatchingBadge
            score={matchScore}
            gated={scoreType === 'gated'}
            partial={scoreType === 'partial'}
            size="lg"
          />
        </div>

        <div className={`${matchingPanel('emerald')} mb-4`}>
          <p className="text-sm leading-relaxed text-[var(--knu-text-secondary)]">
            {getActiveMatchHelperCopy({
              activeMatch: {
                partnerUserId: '',
                partnerNickname: nickname,
                partnerDormitoryId: dormitoryId,
                matchId: '',
                matchScore,
                scoreType,
                matchedAt: '',
                cancelRequestedAt: cancelPending ? 'pending' : null,
                cancelRequestedBy: cancelRequestedByCurrentUser ? 'me' : 'other',
                cancelRequestKind,
              },
              cancelPending,
              cancelRequestedByCurrentUser,
            })}
          </p>
          {cancelPending && !cancelRequestedByCurrentUser && (
            <p className="mt-2 text-xs font-semibold text-green-700">
              현재 승인 {cancelApprovalCount}/{cancelApprovalTotal}
            </p>
          )}
        </div>

        <div className="space-y-2.5">
          <button
            disabled
            className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-400"
          >
            <span className="flex items-center justify-center gap-2">
              <MessageCircle className="h-4 w-4" />
              대화 기능 준비 중
            </span>
          </button>

          <motion.button
            onClick={onViewProfile}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full rounded-xl bg-[var(--knu-primary)] px-4 py-3.5 text-sm font-bold text-white hover:bg-[var(--knu-primary-hover)]"
          >
            <span className="flex items-center justify-center gap-2">
              <User className="h-4 w-4" />
              파트너 프로필 보기
            </span>
          </motion.button>

          <motion.button
            onClick={onRelease}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
              cancelPending && cancelRequestedByCurrentUser
                ? 'border-2 border-[var(--knu-border)] bg-white text-[var(--knu-text-primary)] hover:bg-[var(--knu-background-alt)]'
                : 'text-rose-600 hover:bg-rose-50'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {cancelPending
                ? cancelRequestedByCurrentUser
                  ? '취소 요청 철회'
                  : '매칭 취소 승인하기'
                : '매칭 취소하기'}
            </span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

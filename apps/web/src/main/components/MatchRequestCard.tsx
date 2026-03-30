'use client';

import { motion } from 'motion/react';
import { Clock, Inbox, Send, Sparkles } from 'lucide-react';
import { getAvatarColor } from '@/utils/avatarColor';
import { getDormitoryLabel } from '@/utils/dormitoryLabel';
import { useExpiryCountdown } from '@/hooks/useExpiryCountdown';
import { MatchingBadge } from './matching/MatchingBadge';
import {
  matchingBorder,
  matchingCardShell,
  matchingChip,
  matchingToneByScore,
  type MatchingTone,
} from '@/main/styles/matching';
import type { MatchRequest, MatchScoreType } from '@/types/match';
import type { RoommateProfile } from '@/types/profile';

interface MatchRequestCardProps {
  request: MatchRequest;
  direction: 'sent' | 'received';
  partnerProfile: Omit<RoommateProfile, 'matchScore'> & { matchScore: number };
  scoreType?: MatchScoreType;
  viewerId?: string;
  groupTargetNicknames?: string[];
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
  viewerId,
  groupTargetNicknames,
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
  const isGroupJoinSent = isSent && request.requestKind === 'GROUP_JOIN';
  const approvalCount = request.approvalUserIds?.length ?? 0;
  const approvalTotal =
    request.requestKind === 'GROUP_JOIN' ? (request.groupTargetUserIds?.length ?? 2) : 1;
  const viewerApproved = viewerId ? request.approvalUserIds?.includes(viewerId) === true : false;
  const tone: MatchingTone = isSent
    ? 'slate'
    : isUrgent
      ? 'rose'
      : matchingToneByScore(partnerProfile.matchScore);

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
      className={`${matchingCardShell} ${matchingBorder(tone)} ${
        onClick ? 'cursor-pointer transition-transform duration-200 hover:-translate-y-0.5' : ''
      }`}
    >
      <div className="p-4">
        {/* chip 행: 방향 + 긴급/New만 */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={matchingChip(isSent ? 'slate' : tone)}>
              {isSent ? <Send className="h-3 w-3" /> : <Inbox className="h-3 w-3" />}
              {isGroupJoinSent ? '보낸 그룹 요청' : isSent ? '보낸 요청' : '받은 요청'}
            </span>
            {request.requestKind === 'GROUP_JOIN' && !isGroupJoinSent && (
              <span className={matchingChip('cobalt')}>
                {approvalCount}/{approvalTotal} 승인
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {isNew && !isSent && (
              <motion.span
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={matchingChip('rose')}
              >
                New
              </motion.span>
            )}
            {isUrgent && !isExpired && (
              <motion.span
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                className={matchingChip('amber')}
              >
                <Clock className="h-3 w-3" />
                임박
              </motion.span>
            )}
          </div>
        </div>

        {/* 아바타 + 닉네임(+추천) + 건물·타이머 + 매칭도 */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {isGroupJoinSent && groupTargetNicknames && groupTargetNicknames.length >= 2 ? (
              <div className="relative h-10 w-14 flex-shrink-0">
                {groupTargetNicknames.slice(0, 2).map((name, index) => {
                  const color = getAvatarColor(name);
                  return (
                    <div
                      key={name}
                      className={`absolute top-0 h-10 w-10 rounded-full ring-2 ring-white flex items-center justify-center text-sm font-bold ${color.bg} ${color.text} ${
                        index === 0 ? 'left-0 z-10' : 'left-4'
                      }`}
                    >
                      {name.charAt(0)}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                className={`h-10 w-10 ${avatarColor.bg} rounded-full flex items-center justify-center text-sm font-bold ${avatarColor.text} flex-shrink-0 ring-2 ring-white`}
              >
                {partnerProfile.nickname.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h4 className="font-bold text-[var(--knu-text-primary)] truncate">
                  {isGroupJoinSent && groupTargetNicknames && groupTargetNicknames.length >= 2
                    ? `${groupTargetNicknames[0]} · ${groupTargetNicknames[1]}`
                    : partnerProfile.nickname}
                </h4>
                {isRecommended && (
                  <span className="flex items-center gap-0.5 text-xs font-bold text-purple-600">
                    <Sparkles className="h-3 w-3" />
                    추천
                  </span>
                )}
              </div>
              <p
                className="mt-0.5 text-xs text-[var(--knu-text-tertiary)] flex items-center gap-1"
                suppressHydrationWarning
              >
                {dormLabel}
                {dormLabel && ' · '}
                <Clock className="h-3 w-3 inline" />
                <span suppressHydrationWarning>{isExpired ? '만료됨' : timeLeft}</span>
              </p>
            </div>
          </div>
          {!isGroupJoinSent && (
            <MatchingBadge
              score={partnerProfile.matchScore}
              gated={scoreType === 'gated'}
              partial={scoreType === 'partial'}
            />
          )}
        </div>

        {/* 메시지 (있으면만) */}
        {request.message && (
          <div className="mb-3 rounded-xl bg-[var(--knu-background-alt)] px-3 py-2.5">
            <p className="text-sm text-[var(--knu-text-secondary)] line-clamp-2">
              &ldquo;{request.message}&rdquo;
            </p>
          </div>
        )}

        {/* 버튼 */}
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {isSent ? (
            <motion.button
              onClick={() => onCancel?.(request.id)}
              disabled={isExpired}
              whileHover={isExpired ? undefined : { scale: 1.01 }}
              whileTap={isExpired ? undefined : { scale: 0.99 }}
              className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                isExpired
                  ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                  : 'border-slate-200 bg-white text-[var(--knu-text-secondary)] hover:bg-slate-50'
              }`}
            >
              요청 취소
            </motion.button>
          ) : (
            <>
              <motion.button
                onClick={() => onReject?.(request.id)}
                disabled={isExpired}
                whileHover={isExpired ? undefined : { scale: 1.01 }}
                whileTap={isExpired ? undefined : { scale: 0.99 }}
                className={`w-[35%] rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isExpired
                    ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                    : 'border-rose-200 bg-white text-rose-600 hover:bg-rose-50'
                }`}
              >
                거절
              </motion.button>
              <motion.button
                onClick={() => onAccept?.(request.id)}
                disabled={isExpired || viewerApproved}
                whileHover={isExpired ? undefined : { scale: 1.01 }}
                whileTap={isExpired ? undefined : { scale: 0.99 }}
                className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                  isExpired || viewerApproved
                    ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                    : 'bg-[var(--knu-primary)] text-white hover:bg-[var(--knu-primary-hover)]'
                }`}
              >
                {request.requestKind === 'GROUP_JOIN'
                  ? viewerApproved
                    ? '내 승인 완료'
                    : '합류 승인하기'
                  : '수락하고 대화 열기'}
              </motion.button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

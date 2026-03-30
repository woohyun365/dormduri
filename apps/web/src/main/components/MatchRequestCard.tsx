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
  matchingDisplayTitle,
  matchingPanel,
  matchingToneByScore,
  type MatchingTone,
} from '@/main/styles/matching';
import { getMatchRequestHelperCopy } from './matching/policyCopy';
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

  const summaryTitle = isGroupJoinSent
    ? '그룹의 검토를 기다리는 중이에요'
    : isSent
      ? '답변을 기다리는 중이에요'
      : isUrgent
        ? '만료 전에 답변이 필요해요'
        : '프로필을 확인하고 대화를 시작할 수 있어요';

  const summaryBody = getMatchRequestHelperCopy({
    direction,
    requestKind: request.requestKind,
    isUrgent,
    approvalCount,
    approvalTotal,
  });

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
      <div className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className={matchingChip(isSent ? 'slate' : tone)}>
            {isSent ? <Send className="h-3 w-3" /> : <Inbox className="h-3 w-3" />}
            {isGroupJoinSent ? '보낸 그룹 요청' : isSent ? '보낸 요청' : '받은 요청'}
          </span>
          {isRecommended && !isSent && (
            <motion.span
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={matchingChip('emerald')}
            >
              <Sparkles className="h-3 w-3" />
              추천 매칭
            </motion.span>
          )}
          {request.requestKind === 'GROUP_JOIN' && !isGroupJoinSent && (
            <span className={matchingChip('cobalt')}>
              {approvalCount}/{approvalTotal} 승인
            </span>
          )}
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
              응답 임박
            </motion.span>
          )}
        </div>

        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {isGroupJoinSent && groupTargetNicknames && groupTargetNicknames.length >= 2 ? (
              <div className="relative h-12 w-16 flex-shrink-0">
                {groupTargetNicknames.slice(0, 2).map((nickname, index) => {
                  const color = getAvatarColor(nickname);
                  return (
                    <div
                      key={nickname}
                      className={`absolute top-0 h-12 w-12 rounded-full ring-4 ring-white flex items-center justify-center text-base font-bold ${color.bg} ${color.text} ${
                        index === 0 ? 'left-0' : 'left-5'
                      }`}
                    >
                      {nickname.charAt(0)}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                className={`h-12 w-12 ${avatarColor.bg} rounded-full flex items-center justify-center text-base font-bold ${avatarColor.text} flex-shrink-0 ring-4 ring-white`}
              >
                {partnerProfile.nickname.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[var(--knu-text-secondary)]">
                {summaryTitle}
              </p>
              <h4 className={`${matchingDisplayTitle} mt-1 truncate text-[1.35rem] leading-none`}>
                {isGroupJoinSent && groupTargetNicknames && groupTargetNicknames.length >= 2
                  ? `${groupTargetNicknames[0]} · ${groupTargetNicknames[1]} 그룹`
                  : partnerProfile.nickname}
              </h4>
              {dormLabel && (
                <p className="mt-1 text-sm text-[var(--knu-text-tertiary)]">{dormLabel}</p>
              )}
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

        <div className={`${matchingPanel(tone)} mb-4`}>
          <p className="text-sm leading-relaxed text-[var(--knu-text-secondary)]">{summaryBody}</p>
          {request.message && (
            <div className="mt-3 rounded-2xl border border-white/70 bg-white/80 px-3.5 py-3">
              <p className="text-xs font-semibold text-[var(--knu-text-tertiary)]">한마디</p>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--knu-text-secondary)]">
                &ldquo;{request.message}&rdquo;
              </p>
            </div>
          )}
        </div>

        <div className="mb-4 flex items-center justify-between gap-3" suppressHydrationWarning>
          <div
            className={`flex items-center gap-2 text-xs font-semibold ${
              isExpired
                ? 'text-rose-600'
                : isUrgent
                  ? 'text-amber-700'
                  : 'text-[var(--knu-text-tertiary)]'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span suppressHydrationWarning>
              {isExpired
                ? '응답 창이 종료됐어요'
                : isUrgent
                  ? `남은 시간 ${timeLeft}`
                  : `응답 창 ${timeLeft}`}
            </span>
          </div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--knu-text-tertiary)]">
            {isSent ? '대기 중' : '응답 필요'}
          </p>
        </div>

        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {isSent ? (
            <motion.button
              onClick={() => onCancel?.(request.id)}
              disabled={isExpired}
              whileHover={isExpired ? undefined : { scale: 1.01 }}
              whileTap={isExpired ? undefined : { scale: 0.99 }}
              className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${
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
                className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${
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
                className={`flex-1 rounded-2xl px-4 py-3 text-sm font-bold transition-colors ${
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

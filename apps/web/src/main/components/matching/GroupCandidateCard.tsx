'use client';

import { motion } from 'motion/react';
import { Check, ShieldAlert, Users } from 'lucide-react';
import { getAvatarColor } from '@/utils/avatarColor';
import { matchingCardShell, matchingChip, matchingPanel } from '@/main/styles/matching';
import type { ActiveMatchGroupStage, CancelRequestKind, GroupMemberSnapshot } from '@/types/match';

interface GroupCandidateCardProps {
  stage?: ActiveMatchGroupStage;
  members: GroupMemberSnapshot[];
  viewerConfirmed?: boolean;
  cancelPending?: boolean;
  cancelRequestedByCurrentUser?: boolean;
  cancelRequestKind?: CancelRequestKind | null;
  onConfirmGroup?: () => void;
  onRevokeConfirmGroup?: () => void;
  onLeaveGroup: () => void;
}

export function GroupCandidateCard({
  stage = 'GROUP_FORMING',
  members,
  viewerConfirmed = false,
  cancelPending = false,
  cancelRequestedByCurrentUser = false,
  cancelRequestKind = null,
  onConfirmGroup,
  onRevokeConfirmGroup,
  onLeaveGroup,
}: GroupCandidateCardProps) {
  const [first, second, candidate] = members;
  const isGroupFinal = stage === 'GROUP_FINAL';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${matchingCardShell} border-2 border-[var(--knu-border)] bg-white`}
    >
      <div className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className={matchingChip('cobalt')}>
            <Users className="h-3 w-3" />
            {isGroupFinal ? '3/3 그룹' : '그룹 대화'}
          </span>
          <span className={matchingChip('emerald')}>합류 멤버</span>
        </div>

        <div className="mb-4">
          <h2 className="text-lg font-bold text-[var(--knu-text-primary)]">
            {isGroupFinal ? '3인 그룹에 합류했어요' : '그룹 대화에 합류했어요'}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--knu-text-secondary)]">
            {isGroupFinal
              ? '지금은 최종 3인실 그룹 상태예요. 그룹을 떠나려면 코어 2명의 동의가 필요합니다.'
              : '최종 3인 그룹이 되려면 모든 구성원이 확정 완료를 눌러야 합니다.'}
          </p>
        </div>

        <div className={`${matchingPanel('cobalt')} mb-4`}>
          <div className="grid grid-cols-3 gap-3">
            <CandidateBubble label="A" nickname={first?.nickname ?? '그룹A'} />
            <CandidateBubble label="B" nickname={second?.nickname ?? '그룹B'} />
            <CandidateBubble label="C" nickname={candidate?.nickname ?? '나'} highlight />
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-800">후보(C)에게 보이는 정책</p>
              <p className="mt-1 text-xs leading-relaxed text-blue-700">
                A·B의 세부 승인 진행 상황은 후보에게 공개되지 않습니다. 내 확정/이탈 의사만 직접
                관리할 수 있어요.
              </p>
              {cancelPending && (
                <p className="mt-2 text-xs font-semibold text-blue-700">
                  {cancelRequestedByCurrentUser
                    ? '이탈 요청이 기록됐어요. 다시 누르면 철회할 수 있습니다.'
                    : cancelRequestKind === 'CANDIDATE_LEAVE'
                      ? '코어의 동의를 기다리는 중이에요.'
                      : '그룹 상태가 갱신되기를 기다리는 중이에요.'}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          {!isGroupFinal && (
            <motion.button
              onClick={viewerConfirmed ? onRevokeConfirmGroup : onConfirmGroup}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={`w-full rounded-xl px-4 py-3 text-sm font-bold ${
                viewerConfirmed
                  ? 'border-2 border-[var(--knu-border)] bg-white text-[var(--knu-text-primary)] hover:bg-[var(--knu-background-alt)]'
                  : 'bg-[var(--knu-primary)] text-white hover:bg-[var(--knu-primary-hover)]'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <Check className="h-4 w-4" />
                {viewerConfirmed ? '확정 완료 취소' : '3인 그룹 확정하기'}
              </span>
            </motion.button>
          )}

          <motion.button
            onClick={onLeaveGroup}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={`w-full rounded-xl px-4 py-3 text-sm font-semibold ${
              cancelPending && cancelRequestedByCurrentUser
                ? 'border-2 border-[var(--knu-border)] bg-white text-[var(--knu-text-primary)] hover:bg-[var(--knu-background-alt)]'
                : 'text-rose-600 hover:bg-rose-50'
            }`}
          >
            {cancelPending && cancelRequestedByCurrentUser ? '이탈 요청 철회' : '그룹 떠나기'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

function CandidateBubble({
  label,
  nickname,
  highlight = false,
}: {
  label: string;
  nickname: string;
  highlight?: boolean;
}) {
  const avatarColor = getAvatarColor(nickname);

  return (
    <div className="text-center">
      <div
        className={`mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full text-base font-bold ${avatarColor.bg} ${avatarColor.text} ${
          highlight ? 'ring-4 ring-blue-100' : ''
        }`}
      >
        {nickname.charAt(0)}
      </div>
      <p className="text-[11px] font-semibold text-[var(--knu-text-tertiary)]">{label}</p>
      <p className="truncate text-sm font-semibold text-[var(--knu-text-primary)]">{nickname}</p>
    </div>
  );
}

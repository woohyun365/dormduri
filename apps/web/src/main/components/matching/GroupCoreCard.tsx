'use client';

import { motion } from 'motion/react';
import { ArrowRight, Check, ShieldAlert, Users } from 'lucide-react';
import { getAvatarColor } from '@/utils/avatarColor';
import { matchingCardShell, matchingChip, matchingPanel } from '@/main/styles/matching';
import { getGroupCoreHelperCopy } from './policyCopy';
import type {
  ActiveMatchGroupRole,
  ActiveMatchGroupStage,
  CancelRequestKind,
  GroupMemberSnapshot,
} from '@/types/match';

interface GroupCoreCardProps {
  stage?: ActiveMatchGroupStage;
  role?: ActiveMatchGroupRole | null;
  members: GroupMemberSnapshot[];
  joinRequestCount: number;
  finalApprovalCount?: number;
  finalApprovalTotal?: number;
  viewerConfirmed?: boolean;
  cancelPending?: boolean;
  cancelRequestedByCurrentUser?: boolean;
  cancelRequestKind?: CancelRequestKind | null;
  cancelApprovalCount?: number;
  cancelApprovalTotal?: number;
  onReviewRequests: () => void;
  onFinalizePair: () => void;
  onConfirmGroup?: () => void;
  onRevokeConfirmGroup?: () => void;
  onDissolve: () => void;
}

export function GroupCoreCard({
  stage = 'PAIR_OPEN',
  role = 'group_core',
  members,
  joinRequestCount,
  finalApprovalCount = 0,
  finalApprovalTotal = 3,
  viewerConfirmed = false,
  cancelPending = false,
  cancelRequestedByCurrentUser = false,
  cancelRequestKind = null,
  cancelApprovalCount = 0,
  cancelApprovalTotal = 2,
  onReviewRequests,
  onFinalizePair,
  onConfirmGroup,
  onRevokeConfirmGroup,
  onDissolve,
}: GroupCoreCardProps) {
  const [first, second] = members;
  const candidate = members[2];
  const isPairOpen = stage === 'PAIR_OPEN';
  const isGroupForming = stage === 'GROUP_FORMING';
  const isGroupFinal = stage === 'GROUP_FINAL';
  const title = isPairOpen
    ? '개인 매칭에서 그룹 코어로 승격되었어요'
    : isGroupForming
      ? role === 'group_candidate'
        ? '그룹 대화에 합류했어요'
        : '3인 그룹 대화가 열렸어요'
      : '3인 그룹이 확정되었어요';
  const body = isPairOpen
    ? '3인실 건물에서는 A·B가 먼저 짝이 된 뒤, 한 명을 더 받아 3인 그룹으로 확장할 수 있어요. 지금은 최종 확정 상태가 아니라 그룹 모집 상태예요.'
    : isGroupForming
      ? `이제 ${finalApprovalTotal}명이 모두 확정 버튼을 눌러야 최종 3인 그룹이 됩니다.`
      : '최종 3인실 그룹 상태예요. 이제 추가 합류 요청은 받지 않습니다.';

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
            {isPairOpen ? '2/3 그룹' : '3/3 그룹'}
          </span>
          <span className={matchingChip(isPairOpen ? 'amber' : 'emerald')}>
            {isPairOpen
              ? '한 명을 더 받을 수 있어요'
              : role === 'group_candidate'
                ? '합류 멤버'
                : '그룹 코어'}
          </span>
          {isGroupForming && (
            <span className={matchingChip('cobalt')}>
              {finalApprovalCount}/{finalApprovalTotal} 확정
            </span>
          )}
        </div>

        <div className="mb-4">
          <h2 className="text-lg font-bold text-[var(--knu-text-primary)]">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--knu-text-secondary)]">{body}</p>
        </div>

        <div className={`${matchingPanel('cobalt')} mb-4`}>
          <div className="flex items-center justify-between gap-3">
            <GroupMemberBubble label="A" nickname={first?.nickname ?? '나'} />
            <ArrowRight className="h-4 w-4 flex-shrink-0 text-[var(--knu-text-tertiary)]" />
            <GroupMemberBubble label="B" nickname={second?.nickname ?? '파트너'} />
            <ArrowRight className="h-4 w-4 flex-shrink-0 text-[var(--knu-text-tertiary)]" />
            {isPairOpen ? (
              <EmptySeatBubble />
            ) : (
              <GroupMemberBubble label="C" nickname={candidate?.nickname ?? '합류 멤버'} />
            )}
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-800">그룹 role 처리 기준</p>
              <p className="mt-1 text-xs leading-relaxed text-blue-700">
                {getGroupCoreHelperCopy({
                  stage,
                  role,
                  finalApprovalCount,
                  finalApprovalTotal,
                })}
              </p>
              {cancelPending && (
                <p className="mt-2 text-xs font-semibold text-blue-700">
                  {cancelRequestedByCurrentUser
                    ? '내 요청이 기록되어 있어요. 다시 누르면 요청을 철회할 수 있어요.'
                    : `현재 취소 승인 ${cancelApprovalCount}/${cancelApprovalTotal}`}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          {isPairOpen ? (
            <>
              <motion.button
                onClick={onReviewRequests}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full rounded-xl bg-[var(--knu-primary)] px-4 py-3 text-sm font-bold text-white hover:bg-[var(--knu-primary-hover)]"
              >
                받은 합류 요청 보기{joinRequestCount > 0 ? ` (${joinRequestCount})` : ''}
              </motion.button>

              <motion.button
                onClick={onFinalizePair}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full rounded-xl border-2 border-[var(--knu-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--knu-text-primary)] hover:bg-[var(--knu-background-alt)]"
              >
                <span className="flex items-center justify-center gap-1.5">
                  <Check className="h-4 w-4" />
                  2인으로 마감하기
                </span>
              </motion.button>
            </>
          ) : isGroupForming ? (
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
              {viewerConfirmed ? '확정 완료 취소' : '3인 그룹 확정하기'}
            </motion.button>
          ) : isGroupFinal ? (
            <motion.button
              onClick={onDissolve}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={`w-full rounded-xl px-4 py-3 text-sm font-bold ${
                cancelPending && cancelRequestedByCurrentUser
                  ? 'border-2 border-[var(--knu-border)] bg-white text-[var(--knu-text-primary)] hover:bg-[var(--knu-background-alt)]'
                  : cancelPending
                    ? 'bg-[var(--knu-primary)] text-white hover:bg-[var(--knu-primary-hover)]'
                    : 'text-rose-600 hover:bg-rose-50'
              }`}
            >
              {cancelPending
                ? cancelRequestedByCurrentUser
                  ? cancelRequestKind === 'CANDIDATE_LEAVE'
                    ? '이탈 요청 철회'
                    : '취소 요청 철회'
                  : cancelRequestKind === 'CANDIDATE_LEAVE'
                    ? '후보 이탈 승인하기'
                    : '그룹 해체 승인하기'
                : role === 'group_candidate'
                  ? '그룹 떠나기'
                  : '그룹 해체 요청'}
            </motion.button>
          ) : null}

          {!isGroupFinal && (
            <motion.button
              onClick={onDissolve}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
            >
              그룹 해체
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function GroupMemberBubble({ label, nickname }: { label: string; nickname: string }) {
  const avatarColor = getAvatarColor(nickname);

  return (
    <div className="min-w-0 flex-1 text-center">
      <div
        className={`mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full text-base font-bold ${avatarColor.bg} ${avatarColor.text}`}
      >
        {nickname.charAt(0)}
      </div>
      <p className="text-[11px] font-semibold text-[var(--knu-text-tertiary)]">{label}</p>
      <p className="truncate text-sm font-semibold text-[var(--knu-text-primary)]">{nickname}</p>
    </div>
  );
}

function EmptySeatBubble() {
  return (
    <div className="min-w-0 flex-1 text-center">
      <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-amber-300 bg-amber-50 text-base font-bold text-amber-700">
        +
      </div>
      <p className="text-[11px] font-semibold text-[var(--knu-text-tertiary)]">C</p>
      <p className="text-sm font-semibold text-amber-700">빈 자리</p>
    </div>
  );
}

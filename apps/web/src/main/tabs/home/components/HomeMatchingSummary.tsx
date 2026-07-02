'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Inbox,
  Lock,
  MessageCircle,
  MessagesSquare,
  Send,
  ShieldAlert,
  TrendingUp,
  UserRound,
  UserRoundCheck,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { Z_INDEX } from '@/constants/ui';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { sectionCard, sectionHeader, glassCard } from '@/main/styles/home';
import type { ActiveMatchUnmatchProgress } from '@repo/shared/match/contract';
import type { RoommateSearchSummary } from '@repo/shared/roommate-search/contract';
import type { TabId, MatchingNavOptions } from '@/types/profile';
import type { ComponentType, ReactNode, Ref } from 'react';

// --- Types ---

export type MatchingSummaryStatus =
  | 'ACTIVE_MATCH'
  | 'HAS_ACTIVITY'
  | 'NO_ACTIVITY'
  | 'NOT_OPERATED'
  | 'OFF_SEASON'
  | 'SEASON_OPEN';

export interface MatchingSummaryStats {
  sentRequests: number;
  receivedRequests: number;
  activeChats: number;
  maxPending?: number;
  expiringCount?: number;
}

export interface MatchingSummaryActiveMatch {
  id: string;
  counterpartUserId: string;
  counterpartParticipantId: string;
  nickname: string;
  matchScore: number;
  matchedAt: string;
  unmatchProgress: ActiveMatchUnmatchProgress;
  counterpartSummary?: RoommateSearchSummary;
  groupStage?: 'PAIR_OPEN' | 'PAIR_FINAL' | 'GROUP_FORMING' | 'GROUP_FINAL' | null;
  groupMemberCount?: 2 | 3;
  groupCapacity?: 2 | 3;
}

export interface ActiveMatchRoomSelectionSummary {
  date: string;
  dormitoryName: string;
}

export interface HomeMatchingSummaryProps {
  status: MatchingSummaryStatus;
  stats: MatchingSummaryStats;
  activeMatch?: MatchingSummaryActiveMatch;
  activeMatchRoomSelection?: ActiveMatchRoomSelectionSummary;
  receivedRequesters?: string[];
  gatingReason?: 'registration_required' | null;
  onGatedAction?: () => void;
  onRequestUnmatch?: (activeMatchId: string) => Promise<void>;
  onCancelUnmatchRequest?: (activeMatchId: string) => Promise<void>;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
}

type ActiveMatchModal = 'profile' | 'request-unmatch' | 'cancel-unmatch' | null;

// --- Component ---

export function HomeMatchingSummary({
  status,
  stats,
  activeMatch,
  activeMatchRoomSelection,
  gatingReason,
  onGatedAction,
  onRequestUnmatch,
  onCancelUnmatchRequest,
  onNavigate,
}: HomeMatchingSummaryProps) {
  const maxPending = stats.maxPending ?? 3;
  const expiringCount = stats.expiringCount ?? 0;
  const shouldShowStats = status === 'HAS_ACTIVITY' || status === 'NO_ACTIVITY';

  // 게이팅 상태
  if (gatingReason === 'registration_required') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={sectionCard()}
      >
        <div className={sectionHeader}>
          <h2 className="font-bold text-(--knu-text-primary)">매칭 활동</h2>
          <Lock className="w-5 h-5 text-(--knu-text-tertiary)" />
        </div>
        <div className={glassCard('amber', 'p-4 shadow-md')}>
          <div className="flex items-start gap-3 mb-3">
            <div className="w-12 h-12 bg-amber-100/80 rounded-full flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-amber-900 mb-1">시즌 참여가 필요해요</h3>
              <p className="text-sm text-amber-700 leading-relaxed">
                시즌 프로필과 기숙사를 준비한 뒤 참여 신청을 완료하면 매칭 활동을 시작할 수 있어요
              </p>
            </div>
          </div>
          <motion.button
            onClick={onGatedAction}
            animate={{ scale: [1, 1.015, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            whileTap={{ scale: 0.98 }}
            className="w-full backdrop-blur-sm bg-amber-600/90 hover:bg-amber-700/90 border border-amber-500/50 text-white font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20"
          >
            <ClipboardList className="w-4 h-4" />
            <span>시즌 참여 준비하기</span>
            <ChevronRight className="w-4 h-4" />
          </motion.button>
        </div>
        <div className="mt-4 text-xs text-(--knu-text-tertiary) text-center">
          💡 시즌 참여 완료 후 같은 기숙사 룸메 후보와 상호작용할 수 있어요.
        </div>
      </motion.div>
    );
  }

  if (status === 'ACTIVE_MATCH' && activeMatch) {
    return (
      <ActiveMatchSummaryCard
        activeMatch={activeMatch}
        roomSelection={activeMatchRoomSelection}
        onNavigate={onNavigate}
        onRequestUnmatch={onRequestUnmatch}
        onCancelUnmatchRequest={onCancelUnmatchRequest}
      />
    );
  }

  return (
    <div className={sectionCard()}>
      {/* 헤더 */}
      <div className={sectionHeader}>
        <h2 className="font-bold text-(--knu-text-primary)">매칭 활동</h2>
        <TrendingUp className="w-5 h-5 text-(--knu-primary)" />
      </div>

      {/* 통계 그리드 */}
      {shouldShowStats && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {/* 보낸 요청 */}
            <motion.button
              onClick={() => onNavigate('matching', { requestTab: 'sent' })}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex flex-col items-center p-3 bg-(--knu-background-alt) hover:bg-amber-50 rounded-xl transition-colors group"
            >
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Send className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-xl font-bold text-amber-600">
                {stats.sentRequests}/{maxPending}
              </span>
              <span className="text-xs text-(--knu-text-tertiary) mt-0.5 font-medium">
                보낸 요청
              </span>
              <span className="text-[10px] text-amber-600 mt-0.5">수락 대기 중</span>
              {/* 슬롯 도트 */}
              <div className="flex items-center gap-1 mt-1.5">
                {Array.from({ length: maxPending }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      i < stats.sentRequests ? 'bg-amber-600' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </motion.button>

            {/* 받은 요청 */}
            <motion.button
              onClick={() => onNavigate('matching', { requestTab: 'received' })}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex flex-col items-center p-3 bg-(--knu-background-alt) hover:bg-purple-50 rounded-xl transition-colors group relative"
            >
              {/* 펄스 (셀 전체) */}
              {stats.receivedRequests > 0 && (
                <motion.div
                  className="absolute inset-0 rounded-xl bg-purple-400"
                  initial={{ opacity: 0.5, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.1 }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform relative z-10">
                <Inbox className="w-5 h-5 text-purple-600" />
              </div>
              <AnimatedCounter
                value={stats.receivedRequests}
                className="text-xl font-bold text-purple-600"
              />
              <span className="text-xs text-(--knu-text-tertiary) mt-0.5 font-medium">
                받은 요청
              </span>
              <span className="text-[10px] text-purple-600 mt-0.5">응답 필요</span>
              {/* 만료 임박 */}
              {expiringCount > 0 && (
                <div className="flex items-center gap-1 mt-1.5 bg-orange-100 px-2 py-0.5 rounded-full">
                  <AlertTriangle className="w-2.5 h-2.5 text-orange-600" />
                  <span className="text-[9px] font-medium text-orange-600">
                    {expiringCount}건 곧 만료
                  </span>
                </div>
              )}
            </motion.button>

            {/* 대화 중 */}
            <motion.button
              onClick={() => onNavigate('matching', { section: 'current' })}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex flex-col items-center p-3 bg-(--knu-background-alt) hover:bg-teal-50 rounded-xl transition-colors group"
            >
              <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <MessagesSquare className="w-5 h-5 text-teal-600" />
              </div>
              <span className="text-xl font-bold text-teal-600">{stats.activeChats}</span>
              <span className="text-xs text-(--knu-text-tertiary) mt-0.5 font-medium">대화 중</span>
              <span className="text-[10px] text-teal-600 mt-0.5">진행 중</span>
            </motion.button>
          </div>

          <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-amber-700">
            <Zap className="size-3.5 text-amber-500" aria-hidden={true} />
            <span>생활패턴과 대화를 통해 서로 잘 맞는지 알아가보세요!</span>
          </div>
        </>
      )}
    </div>
  );
}

function ActiveMatchSummaryCard({
  activeMatch,
  roomSelection,
  onNavigate,
  onRequestUnmatch,
  onCancelUnmatchRequest,
}: {
  activeMatch: MatchingSummaryActiveMatch;
  roomSelection?: ActiveMatchRoomSelectionSummary;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
  onRequestUnmatch?: (activeMatchId: string) => Promise<void>;
  onCancelUnmatchRequest?: (activeMatchId: string) => Promise<void>;
}) {
  const [modal, setModal] = useState<ActiveMatchModal>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const progress = activeMatch.unmatchProgress;
  const canSubmitUnmatch = progress.canRequest || progress.canCancel;
  const progressLabel = `${progress.progressCount}/${progress.requiredCount}`;
  const matchedDate = formatKoreanMonthDay(activeMatch.matchedAt);

  const handleConfirmUnmatch = async () => {
    setSubmitting(true);
    setActionError(null);
    try {
      if (modal === 'cancel-unmatch') {
        await onCancelUnmatchRequest?.(activeMatch.id);
      } else {
        await onRequestUnmatch?.(activeMatch.id);
      }
      setModal(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '요청을 처리하지 못했어요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={sectionCard()} aria-labelledby="home-matching-summary-title">
      <div className={sectionHeader}>
        <div>
          <p className="mb-1 text-xs font-bold text-indigo-600">매칭 활동</p>
          <h2 id="home-matching-summary-title" className="font-bold text-(--knu-text-primary)">
            확정된 룸메이트
          </h2>
        </div>
        <UserRoundCheck className="h-5 w-5 text-indigo-600" aria-hidden={true} />
      </div>

      <div className="rounded-3xl border border-indigo-100 bg-linear-to-br from-indigo-50 via-white to-cyan-50 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/25">
            <UserRoundCheck className="size-6" aria-hidden={true} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-indigo-700">현재 매칭 상대</p>
            <h3 className="mt-0.5 truncate text-xl font-extrabold text-(--knu-text-primary)">
              {activeMatch.nickname}님
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-(--knu-text-secondary)">
              {matchedDate}부터 확정된 룸메이트예요. 호실 선택 전까지 필요한 내용을 함께
              확인해보세요.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <ActiveMatchMetric
            icon={UserRound}
            label="매칭도"
            value={`${activeMatch.matchScore}%`}
            helper="프로필 기준"
            tone="indigo"
          />
          <ActiveMatchMetric
            icon={CalendarDays}
            label="호실 선택일"
            value={roomSelection?.date ?? '확인 필요'}
            helper={
              roomSelection?.dormitoryName ? `${roomSelection.dormitoryName} 기준` : '기숙사 기준'
            }
            tone="cyan"
          />
          <ActiveMatchMetric
            icon={ShieldAlert}
            label="해제 진행"
            value={progressLabel}
            helper={resolveUnmatchProgressHelper(progress)}
            tone={progress.progressCount > 0 ? 'amber' : 'slate'}
          />
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setModal('profile')}
            className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            <UserRound className="size-4" aria-hidden={true} />
            상대 프로필 보기
          </button>
          <button
            type="button"
            onClick={() => onNavigate('chat')}
            className="flex items-center justify-center gap-2 rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-sm font-bold text-cyan-700 transition-colors hover:bg-cyan-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
          >
            <MessageCircle className="size-4" aria-hidden={true} />
            채팅 바로가기
            <ChevronRight className="size-4" aria-hidden={true} />
          </button>
        </div>

        <div className="mt-3 rounded-2xl border border-rose-100 bg-rose-50/80 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-bold text-rose-900">매칭 해제</p>
              <p className="mt-0.5 text-xs leading-relaxed text-rose-700">
                양쪽이 모두 요청해야 해제가 완료돼요. 한쪽 요청만으로는 매칭이 유지돼요.
              </p>
            </div>
            {canSubmitUnmatch ? (
              <button
                type="button"
                onClick={() => setModal(progress.canCancel ? 'cancel-unmatch' : 'request-unmatch')}
                className="shrink-0 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
              >
                {progress.canCancel ? '해제 요청 철회' : '매칭 해제 요청'}
              </button>
            ) : (
              <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-rose-500">
                요청 불가
              </span>
            )}
          </div>
        </div>
      </div>

      {modal === 'profile' && (
        <ActiveMatchProfileModal activeMatch={activeMatch} onClose={() => setModal(null)} />
      )}
      {(modal === 'request-unmatch' || modal === 'cancel-unmatch') && (
        <UnmatchActionModal
          mode={modal}
          progress={progress}
          isSubmitting={isSubmitting}
          error={actionError}
          onClose={() => {
            setActionError(null);
            setModal(null);
          }}
          onConfirm={handleConfirmUnmatch}
        />
      )}
    </section>
  );
}

function ActiveMatchMetric({
  icon: Icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  label: string;
  value: string;
  helper: string;
  tone: 'indigo' | 'cyan' | 'amber' | 'slate';
}) {
  const toneClassName = {
    indigo: 'border-indigo-100 bg-indigo-50/75 text-indigo-700',
    cyan: 'border-cyan-100 bg-cyan-50/75 text-cyan-700',
    amber: 'border-amber-100 bg-amber-50/80 text-amber-700',
    slate: 'border-slate-200 bg-white/80 text-slate-700',
  }[tone];

  return (
    <div className={`rounded-2xl border p-3 ${toneClassName}`}>
      <div className="flex items-center gap-2">
        <Icon className="size-4 shrink-0" aria-hidden={true} />
        <span className="text-xs font-bold">{label}</span>
      </div>
      <p className="mt-2 text-lg font-extrabold">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium opacity-80">{helper}</p>
    </div>
  );
}

function ActiveMatchProfileModal({
  activeMatch,
  onClose,
}: {
  activeMatch: MatchingSummaryActiveMatch;
  onClose: () => void;
}) {
  const containerRef = useFocusTrap(true, onClose);
  useBodyScrollLock(true);
  const summary = activeMatch.counterpartSummary?.profileSummary;
  const intro = summary?.intro.trim() || '아직 소개 문구가 없어요.';

  return (
    <HomeResponsiveDialog
      focusRef={containerRef}
      label="상대 프로필"
      icon={UserRound}
      eyebrow="매칭 상대 프로필"
      title={`${activeMatch.nickname}님`}
      description="현재 확정된 매칭 상대의 시즌 프로필을 확인해요."
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          확인했어요
        </button>
      }
    >
      <div className="space-y-3">
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
          <p className="text-xs font-bold text-indigo-700">소개</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{intro}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <ProfileSummaryItem label="매칭도" value={`${activeMatch.matchScore}%`} />
          <ProfileSummaryItem label="확인 맥락" value="현재 매칭 상대" />
          <ProfileSummaryItem label="흡연" value={formatProfileValue(summary?.smokingBehavior)} />
          <ProfileSummaryItem label="수면" value={formatProfileValue(summary?.sleepHabit)} />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          상대 프로필은 매칭 결과 확인을 위한 읽기 전용 정보예요. 새 매칭 신청이나 북마크 기능은
          확정 매칭 중에는 열리지 않아요.
        </div>
      </div>
    </HomeResponsiveDialog>
  );
}

function ProfileSummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-(--knu-text-primary)">{value}</p>
    </div>
  );
}

function UnmatchActionModal({
  mode,
  progress,
  isSubmitting,
  error,
  onClose,
  onConfirm,
}: {
  mode: Exclude<ActiveMatchModal, 'profile' | null>;
  progress: ActiveMatchUnmatchProgress;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const containerRef = useFocusTrap(true, onClose);
  useBodyScrollLock(true);
  const isCancel = mode === 'cancel-unmatch';

  return (
    <HomeResponsiveDialog
      focusRef={containerRef}
      label={isCancel ? '매칭 해제 요청 철회' : '매칭 해제 요청'}
      icon={isCancel ? XCircle : ShieldAlert}
      eyebrow="상호 합의 해제"
      title={isCancel ? '해제 요청을 철회할까요?' : '매칭 해제를 요청할까요?'}
      description={
        isCancel
          ? '상대가 아직 요청하지 않았다면 내 해제 요청을 철회할 수 있어요.'
          : '양쪽이 모두 요청해야 매칭 해제가 완료돼요. 한쪽 요청만으로는 현재 매칭이 유지돼요.'
      }
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-rose-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
          >
            {isSubmitting ? '처리 중...' : isCancel ? '요청 철회하기' : '해제 요청하기'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
          <p className="text-xs font-bold text-rose-700">현재 진행률</p>
          <p className="mt-2 text-2xl font-extrabold text-rose-900">
            {progress.progressCount}/{progress.requiredCount}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-rose-700">
            {resolveUnmatchProgressHelper(progress)}
          </p>
        </div>
        <PolicyList
          items={[
            '매칭 해제는 이번 시즌의 현재 확정 매칭만 대상으로 해요.',
            '상대가 아직 요청하지 않았다면 내 요청은 철회할 수 있어요.',
            '양쪽 요청이 모두 모이면 매칭 해제가 완료돼요.',
          ]}
        />
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </div>
    </HomeResponsiveDialog>
  );
}

function HomeResponsiveDialog({
  focusRef,
  label,
  icon: Icon,
  eyebrow,
  title,
  description,
  children,
  footer,
  onClose,
}: {
  focusRef: Ref<HTMLDivElement>;
  label: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 flex items-end justify-center overflow-hidden overscroll-none bg-slate-950/40 px-0 pb-0 pt-4 sm:px-4 sm:pb-4 md:items-center md:py-4"
      style={{ zIndex: Z_INDEX.bottomSheet }}
    >
      <button
        type="button"
        aria-label={`${label} 닫기`}
        className="absolute inset-0"
        onClick={onClose}
      />
      <motion.div
        ref={focusRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative flex h-[min(620px,calc(100dvh-1rem))] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-black/5 sm:h-auto sm:max-h-[min(680px,calc(100dvh-2rem))] sm:rounded-3xl"
      >
        <div className="shrink-0 bg-linear-to-br from-indigo-50 to-cyan-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
                <Icon className="size-5" aria-hidden={true} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-indigo-700">{eyebrow}</p>
                <h3 className="text-lg font-extrabold text-(--knu-text-primary)">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-(--knu-text-secondary)">
                  {description}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/80 text-(--knu-text-secondary) transition-colors hover:bg-white hover:text-(--knu-text-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--knu-primary)"
              aria-label="닫기"
            >
              <X className="size-5" aria-hidden={true} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">{children}</div>
        <div className="shrink-0 border-t border-(--knu-border) bg-white p-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex flex-col gap-2 sm:flex-row">{footer}</div>
        </div>
      </motion.div>
    </div>
  );
}

function PolicyList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-slate-700">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-indigo-500" aria-hidden={true} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function resolveUnmatchProgressHelper(progress: ActiveMatchUnmatchProgress): string {
  if (progress.state === 'WAITING_FOR_COUNTERPART') {
    return '내 요청 대기 중';
  }
  if (progress.state === 'WAITING_FOR_ME') {
    return '상대 요청 도착';
  }
  if (progress.state === 'COMPLETED') {
    return '해제 완료';
  }
  return progress.canRequest ? '요청 가능' : '요청 닫힘';
}

function formatKoreanMonthDay(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '매칭 확정일';
  }
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function formatProfileValue(value: string | null | undefined): string {
  if (!value) return '미입력';
  const labels: Record<string, string> = {
    NO: '비흡연',
    YES: '흡연',
    NONE: '해당 없음',
    CLOSE: '가까운 교류',
    RESPECTFUL: '적당한 거리',
    QUIET: '조용한 편',
    LATE: '늦은 편',
    EARLY: '이른 편',
  };
  return labels[value] ?? value.replaceAll('_', ' ').toLowerCase();
}

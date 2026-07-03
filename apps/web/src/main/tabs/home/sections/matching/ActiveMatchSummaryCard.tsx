'use client';

import { useState } from 'react';
import {
  CalendarDays,
  ChevronRight,
  MessageCircle,
  ShieldAlert,
  UserRound,
  UserRoundCheck,
} from 'lucide-react';
import { sectionCard, sectionHeader } from '@/main/styles/home';
import type { MatchingNavOptions, TabId } from '@/types/profile';
import { ActiveMatchProfileTrigger } from './ActiveMatchProfileTrigger';
import { ActiveMatchMetricCard } from './MatchingMetricCard';
import { UnmatchActionDialog, type UnmatchDialogMode } from './UnmatchActionDialog';
import { resolveUnmatchProgressHelper } from './model/matchingSummaryContent';
import type {
  ActiveMatchRoomSelectionSummary,
  MatchingSummaryActiveMatch,
} from './HomeMatchingSummary';

export function ActiveMatchSummaryCard({
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
  const [modal, setModal] = useState<'profile' | UnmatchDialogMode | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const progress = activeMatch.unmatchProgress;
  const canSubmitUnmatch = progress.canRequest || progress.canCancel;
  const progressLabel = `${progress.progressCount}/${progress.requiredCount}`;

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
              {activeMatch.nickname}
            </h3>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <ActiveMatchMetricCard
            icon={UserRound}
            label="매칭도"
            value={`${activeMatch.matchScore}%`}
            helper="프로필 기준"
            tone="indigo"
          />
          <ActiveMatchMetricCard
            icon={CalendarDays}
            label="호실 선택일"
            value={roomSelection?.date ?? '확인 필요'}
            helper={
              roomSelection?.dormitoryName ? `${roomSelection.dormitoryName} 기준` : '기숙사 기준'
            }
            tone="cyan"
          />
          <ActiveMatchMetricCard
            icon={ShieldAlert}
            label="해제 진행"
            value={progressLabel}
            helper={resolveUnmatchProgressHelper(progress)}
            tone={progress.progressCount > 0 ? 'amber' : 'slate'}
          />
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <ActiveMatchProfileTrigger
            activeMatch={activeMatch}
            isOpen={modal === 'profile'}
            onOpen={() => setModal('profile')}
            onClose={() => setModal(null)}
          />
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

      {modal === 'request-unmatch' || modal === 'cancel-unmatch' ? (
        <UnmatchActionDialog
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
      ) : null}
    </section>
  );
}

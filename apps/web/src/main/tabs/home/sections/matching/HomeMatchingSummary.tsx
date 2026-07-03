'use client';

import { motion } from 'motion/react';
import { AlertTriangle, ChevronRight, ClipboardList, Lock, TrendingUp } from 'lucide-react';
import { glassCard, sectionCard, sectionHeader } from '@/main/styles/home';
import type { ActiveMatchUnmatchProgress } from '@repo/shared/match/contract';
import type { RoommateSearchSummary } from '@repo/shared/roommate-search/contract';
import type { MatchingNavOptions, TabId } from '@/types/profile';
import { ActiveMatchSummaryCard } from './ActiveMatchSummaryCard';
import { MatchingActionList } from './MatchingActionList';
import type { MatchingSummaryStats, MatchingSummaryStatus } from './model/matchingSummaryContent';
export type { MatchingSummaryStats, MatchingSummaryStatus } from './model/matchingSummaryContent';

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
  const shouldShowStats = status === 'HAS_ACTIVITY' || status === 'NO_ACTIVITY';

  if (gatingReason === 'registration_required') {
    return <RegistrationRequiredGate onGatedAction={onGatedAction} />;
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
      <div className={sectionHeader}>
        <h2 className="font-bold text-(--knu-text-primary)">매칭 활동</h2>
        <TrendingUp className="w-5 h-5 text-(--knu-primary)" aria-hidden={true} />
      </div>

      {shouldShowStats ? <MatchingActionList stats={stats} onNavigate={onNavigate} /> : null}
    </div>
  );
}

function RegistrationRequiredGate({ onGatedAction }: { onGatedAction?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={sectionCard()}
    >
      <div className={sectionHeader}>
        <h2 className="font-bold text-(--knu-text-primary)">매칭 활동</h2>
        <Lock className="w-5 h-5 text-(--knu-text-tertiary)" aria-hidden={true} />
      </div>
      <div className={glassCard('amber', 'p-4 shadow-md')}>
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100/80">
            <AlertTriangle className="h-6 w-6 text-amber-600" aria-hidden={true} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="mb-1 font-bold text-amber-900">시즌 참여가 필요해요</h3>
            <p className="text-sm leading-relaxed text-amber-700">
              시즌 프로필과 기숙사를 준비한 뒤 참여 신청을 완료하면 매칭 활동을 시작할 수 있어요
            </p>
          </div>
        </div>
        <motion.button
          type="button"
          onClick={onGatedAction}
          animate={{ scale: [1, 1.015, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          whileTap={{ scale: 0.98 }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/50 bg-amber-600/90 px-4 py-2.5 font-medium text-white shadow-lg shadow-amber-600/20 backdrop-blur-sm transition-colors hover:bg-amber-700/90"
        >
          <ClipboardList className="h-4 w-4" aria-hidden={true} />
          <span>시즌 참여 준비하기</span>
          <ChevronRight className="h-4 w-4" aria-hidden={true} />
        </motion.button>
      </div>
      <div className="mt-4 text-center text-xs text-(--knu-text-tertiary)">
        💡 시즌 참여 완료 후 같은 기숙사 룸메 후보와 상호작용할 수 있어요.
      </div>
    </motion.div>
  );
}

'use client';

import { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle,
  Inbox,
  Send,
  MessageCircle,
  Info,
  Clock,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { useSeasonContext } from '@/contexts/SeasonContext';
import { isRequestExpired } from '@/utils/matchRequest';
import { MATCH_POLICY } from '@/constants/match';
import type { MatchRequest, ActiveMatch } from '@/types/match';
import type { RoommateProfile, TabId } from '@/types/profile';

// --- Types ---

type SummaryCase =
  | 'active_match'
  | 'received_and_sent'
  | 'received_only'
  | 'sent_only'
  | 'none'
  | 'not_operated'
  | 'off_season'
  | 'season_open';

interface SummaryData {
  case: SummaryCase;
  receivedPending: number;
  sentPending: number;
  conversationCount: number;
  firstReceivedNickname: string | null;
  activeMatchNickname: string | null;
  activeMatchScore: number | null;
}

export interface HomeMatchingSummaryProps {
  matchRequests: MatchRequest[];
  activeMatch: ActiveMatch | null;
  userId: string;
  isCampusOperated: boolean;
  profiles: Omit<RoommateProfile, 'matchScore'>[];
  onNavigate: (tab: TabId) => void;
}

// --- Component ---

export function HomeMatchingSummary({
  matchRequests,
  activeMatch,
  userId,
  isCampusOperated,
  profiles,
  onNavigate,
}: HomeMatchingSummaryProps) {
  const { state: seasonState } = useSeasonContext();

  const summary = useMemo((): SummaryData => {
    const receivedPending = matchRequests.filter(
      (r) => r.toUserId === userId && r.status === 'PENDING' && !isRequestExpired(r),
    );
    const sentPending = matchRequests.filter(
      (r) => r.fromUserId === userId && r.status === 'PENDING' && !isRequestExpired(r),
    );
    const conversations = matchRequests.filter((r) => r.status === 'IN_CONVERSATION');

    const firstReceived = receivedPending[0];
    const firstReceivedProfile = firstReceived
      ? profiles.find((p) => p.id === firstReceived.fromUserId)
      : null;

    const base = {
      receivedPending: receivedPending.length,
      sentPending: sentPending.length,
      conversationCount: conversations.length,
      firstReceivedNickname: firstReceivedProfile?.nickname ?? null,
      activeMatchNickname: activeMatch?.partnerNickname ?? null,
      activeMatchScore: activeMatch?.matchScore ?? null,
    };

    if (!isCampusOperated) return { ...base, case: 'not_operated' };
    if (seasonState === 'OFF_SEASON') return { ...base, case: 'off_season' };
    if (seasonState === 'SEASON_OPEN') return { ...base, case: 'season_open' };
    if (activeMatch) return { ...base, case: 'active_match' };
    if (base.receivedPending > 0 && base.sentPending > 0)
      return { ...base, case: 'received_and_sent' };
    if (base.receivedPending > 0) return { ...base, case: 'received_only' };
    if (base.sentPending > 0) return { ...base, case: 'sent_only' };
    return { ...base, case: 'none' };
  }, [matchRequests, activeMatch, userId, isCampusOperated, seasonState, profiles]);

  const showStats =
    summary.case !== 'active_match' &&
    summary.case !== 'not_operated' &&
    summary.case !== 'off_season' &&
    summary.case !== 'season_open';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-5"
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-[var(--knu-text-primary)]">매칭 활동</h2>
        <TrendingUp className="w-5 h-5 text-[var(--knu-primary)]" />
      </div>

      {/* 행동 유도 메시지 */}
      <button
        onClick={() => onNavigate('matching')}
        className="w-full flex items-center gap-3 text-left p-3 bg-[var(--knu-background-alt)] rounded-xl mb-4 hover:bg-gray-100 transition-colors"
      >
        <ActionIcon summaryCase={summary.case} />
        <span className="flex-1 text-sm font-semibold text-[var(--knu-text-primary)]">
          <ActionMessage summary={summary} />
        </span>
        <ChevronRight className="w-4 h-4 text-[var(--knu-text-tertiary)] flex-shrink-0" />
      </button>

      {/* 통계 그리드 (Figma MatchingActivitySummary 디자인) */}
      {showStats && (
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onNavigate('matching')}
            className="flex flex-col items-center p-3 bg-[var(--knu-background-alt)] hover:bg-blue-50 rounded-xl transition-colors group"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Send className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-xl font-bold text-blue-600">
              {summary.sentPending}
              <span className="text-xs font-normal text-[var(--knu-text-tertiary)]">
                /{MATCH_POLICY.MAX_PENDING_REQUESTS}
              </span>
            </span>
            <span className="text-xs text-[var(--knu-text-tertiary)] mt-0.5">보낸 요청</span>
          </button>

          <button
            onClick={() => onNavigate('matching')}
            className="flex flex-col items-center p-3 bg-[var(--knu-background-alt)] hover:bg-purple-50 rounded-xl transition-colors group"
          >
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Inbox className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-xl font-bold text-purple-600">{summary.receivedPending}</span>
            <span className="text-xs text-[var(--knu-text-tertiary)] mt-0.5">받은 요청</span>
          </button>

          <button
            onClick={() => onNavigate('matching')}
            className="flex flex-col items-center p-3 bg-[var(--knu-background-alt)] hover:bg-green-50 rounded-xl transition-colors group"
          >
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <MessageCircle className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-xl font-bold text-green-600">{summary.conversationCount}</span>
            <span className="text-xs text-[var(--knu-text-tertiary)] mt-0.5">대화 중</span>
          </button>
        </div>
      )}
    </motion.div>
  );
}

// --- Sub-components ---

function ActionIcon({ summaryCase }: { summaryCase: SummaryCase }) {
  const iconClass = 'w-5 h-5 flex-shrink-0';
  switch (summaryCase) {
    case 'active_match':
      return <CheckCircle className={`${iconClass} text-green-600`} />;
    case 'received_and_sent':
    case 'received_only':
      return <Inbox className={`${iconClass} text-purple-600`} />;
    case 'sent_only':
      return <Send className={`${iconClass} text-blue-600`} />;
    case 'none':
      return <Clock className={`${iconClass} text-[var(--knu-text-tertiary)]`} />;
    case 'not_operated':
    case 'off_season':
    case 'season_open':
      return <Info className={`${iconClass} text-[var(--knu-text-tertiary)]`} />;
  }
}

function ActionMessage({ summary }: { summary: SummaryData }) {
  switch (summary.case) {
    case 'active_match':
      return (
        <>
          {summary.activeMatchNickname}님과 매칭 중 · 매칭도 {summary.activeMatchScore}%
        </>
      );
    case 'received_and_sent':
    case 'received_only': {
      const extra = summary.receivedPending - 1;
      const suffix = extra > 0 ? ` 외 ${extra}명이` : '님이';
      return (
        <>
          {summary.firstReceivedNickname}
          {suffix} 매칭을 요청했어요
        </>
      );
    }
    case 'sent_only':
      return <>보낸 요청 {summary.sentPending}건 대기 중</>;
    case 'none':
      return <>매칭 요청이 없어요. 룸메를 찾아볼까요?</>;
    case 'not_operated':
      return <>이 캠퍼스는 매칭 서비스를 운영하지 않습니다</>;
    case 'off_season':
      return <>다음 시즌이 시작되면 매칭할 수 있어요</>;
    case 'season_open':
      return <>매칭 시즌이 곧 시작돼요. 프로필을 준비해보세요</>;
  }
}

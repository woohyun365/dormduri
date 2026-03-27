'use client';

import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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

interface ActionItem {
  icon: React.ElementType;
  text: string;
  iconColor: string;
}

interface SummaryData {
  receivedPending: number;
  sentPending: number;
  conversationCount: number;
  firstReceivedNickname: string | null;
  activeMatchNickname: string | null;
  activeMatchScore: number | null;
  showStats: boolean;
  actions: ActionItem[];
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
  const [actionIndex, setActionIndex] = useState(0);

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

    // 비활성 상태 (통계 숨김, 단일 메시지)
    if (!isCampusOperated) {
      return {
        ...base,
        showStats: false,
        actions: [
          {
            icon: Info,
            text: '이 캠퍼스는 매칭 서비스를 운영하지 않습니다',
            iconColor: 'text-[var(--knu-text-tertiary)]',
          },
        ],
      };
    }
    if (seasonState === 'OFF_SEASON') {
      return {
        ...base,
        showStats: false,
        actions: [
          {
            icon: Info,
            text: '다음 시즌이 시작되면 매칭할 수 있어요',
            iconColor: 'text-[var(--knu-text-tertiary)]',
          },
        ],
      };
    }
    if (seasonState === 'SEASON_OPEN') {
      return {
        ...base,
        showStats: false,
        actions: [
          {
            icon: Info,
            text: '매칭 시즌이 곧 시작돼요. 프로필을 준비해보세요',
            iconColor: 'text-[var(--knu-text-tertiary)]',
          },
        ],
      };
    }
    if (activeMatch) {
      return {
        ...base,
        showStats: false,
        actions: [
          {
            icon: CheckCircle,
            text: `${base.activeMatchNickname}님과 매칭 중 · 매칭도 ${base.activeMatchScore}%`,
            iconColor: 'text-green-600',
          },
        ],
      };
    }

    // 활성 상태 — 동적 메시지 배열 구성
    const actions: ActionItem[] = [];
    if (base.receivedPending > 0) {
      const extra = base.receivedPending - 1;
      const suffix = extra > 0 ? ` 외 ${extra}명이` : '님이';
      actions.push({
        icon: Inbox,
        text: `${base.firstReceivedNickname}${suffix} 매칭을 요청했어요`,
        iconColor: 'text-purple-600',
      });
    }
    if (base.sentPending > 0) {
      actions.push({
        icon: Send,
        text: `보낸 요청 ${base.sentPending}건 대기 중`,
        iconColor: 'text-blue-600',
      });
    }
    if (base.conversationCount > 0) {
      actions.push({
        icon: MessageCircle,
        text: `대화 ${base.conversationCount}명 진행 중`,
        iconColor: 'text-green-600',
      });
    }
    if (actions.length === 0) {
      actions.push({
        icon: Clock,
        text: '매칭 요청이 없어요. 룸메를 찾아볼까요?',
        iconColor: 'text-[var(--knu-text-tertiary)]',
      });
    }

    return { ...base, showStats: true, actions };
  }, [matchRequests, activeMatch, userId, isCampusOperated, seasonState, profiles]);

  // 3초 순환 (메시지 2개 이상일 때만)
  useEffect(() => {
    if (summary.actions.length <= 1) return;
    const interval = setInterval(() => {
      setActionIndex((prev) => (prev + 1) % summary.actions.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [summary.actions.length]);

  // actions 변경 시 인덱스 초기화
  useEffect(() => {
    setActionIndex(0);
  }, [summary.actions.length]);

  const currentAction = summary.actions[actionIndex % summary.actions.length];
  const CurrentIcon = currentAction?.icon ?? Info;

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

      {/* 행동 유도 메시지 (순환 애니메이션) */}
      <button
        onClick={() => onNavigate('matching')}
        className="w-full flex items-center gap-3 text-left p-3 bg-[var(--knu-background-alt)] rounded-xl mb-4 hover:bg-gray-100 transition-colors overflow-hidden"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={actionIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-3 flex-1 min-w-0"
          >
            <CurrentIcon className={`w-5 h-5 flex-shrink-0 ${currentAction?.iconColor}`} />
            <span className="flex-1 text-sm font-semibold text-[var(--knu-text-primary)] truncate">
              {currentAction?.text}
            </span>
          </motion.div>
        </AnimatePresence>
        <ChevronRight className="w-4 h-4 text-[var(--knu-text-tertiary)] flex-shrink-0" />
      </button>

      {/* 통계 그리드 */}
      {summary.showStats && (
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

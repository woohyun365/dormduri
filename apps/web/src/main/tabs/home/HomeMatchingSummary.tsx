'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send,
  Inbox,
  Clock,
  Bell,
  MessageCircle,
  TrendingUp,
  ChevronRight,
  CheckCircle,
  Info,
  AlertTriangle,
  Lock,
  Building2,
} from 'lucide-react';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import type { TabId } from '@/types/profile';

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
  nickname: string;
  matchScore: number;
}

export interface HomeMatchingSummaryProps {
  status: MatchingSummaryStatus;
  stats: MatchingSummaryStats;
  activeMatch?: MatchingSummaryActiveMatch;
  receivedRequesters?: string[];
  gatingReason?: 'no_building' | null;
  onGatedAction?: () => void;
  onNavigate: (tab: TabId) => void;
}

// --- Message generation ---

interface ActionMessage {
  icon: React.ElementType;
  iconColor: string;
  text: React.ReactNode;
}

function generateMessages(
  status: MatchingSummaryStatus,
  stats: MatchingSummaryStats,
  activeMatch?: MatchingSummaryActiveMatch,
  receivedRequesters?: string[],
): ActionMessage[] {
  const messages: ActionMessage[] = [];

  switch (status) {
    case 'ACTIVE_MATCH':
      if (activeMatch) {
        messages.push({
          icon: CheckCircle,
          iconColor: 'text-green-600',
          text: `${activeMatch.nickname}님과 매칭 중 · 매칭도 ${activeMatch.matchScore}%`,
        });
      }
      break;

    case 'HAS_ACTIVITY':
      if (stats.receivedRequests > 0) {
        const nickname = receivedRequesters?.[0] ?? '알 수 없음';
        if (stats.receivedRequests > 1) {
          messages.push({
            icon: Inbox,
            iconColor: 'text-purple-600',
            text: (
              <>
                <span className="inline-block max-w-[5rem] truncate align-bottom">{nickname}</span>
                님 외 {stats.receivedRequests - 1}명이 매칭을 요청했어요
              </>
            ),
          });
        } else {
          messages.push({
            icon: Inbox,
            iconColor: 'text-purple-600',
            text: (
              <>
                <span className="inline-block max-w-[5rem] truncate align-bottom">{nickname}</span>
                님이 매칭을 요청했어요
              </>
            ),
          });
        }
      }
      if (stats.sentRequests > 0) {
        messages.push({
          icon: Send,
          iconColor: 'text-blue-600',
          text: `보낸 요청 ${stats.sentRequests}건 대기 중`,
        });
      }
      if (stats.activeChats > 0) {
        messages.push({
          icon: MessageCircle,
          iconColor: 'text-green-600',
          text: `${stats.activeChats}명과 대화가 진행 중이에요`,
        });
      }
      break;

    case 'NO_ACTIVITY':
      messages.push({
        icon: Info,
        iconColor: 'text-gray-500',
        text: '매칭 요청이 없어요. 룸메를 찾아볼까요?',
      });
      break;

    case 'NOT_OPERATED':
      messages.push({
        icon: Info,
        iconColor: 'text-gray-500',
        text: '이 캠퍼스는 매칭 서비스를 운영하지 않습니다',
      });
      break;

    case 'OFF_SEASON':
      messages.push({
        icon: Info,
        iconColor: 'text-gray-500',
        text: '다음 시즌이 시작되면 매칭할 수 있어요',
      });
      break;

    case 'SEASON_OPEN':
      messages.push({
        icon: Info,
        iconColor: 'text-gray-500',
        text: '매칭 시즌이 곧 시작돼요. 프로필을 준비해보세요',
      });
      break;
  }

  return messages;
}

// --- Component ---

export function HomeMatchingSummary({
  status,
  stats,
  activeMatch,
  receivedRequesters,
  gatingReason,
  onGatedAction,
  onNavigate,
}: HomeMatchingSummaryProps) {
  const maxPending = stats.maxPending ?? 3;
  const expiringCount = stats.expiringCount ?? 0;
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  const messages = generateMessages(status, stats, activeMatch, receivedRequesters);

  useEffect(() => {
    if (messages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [messages.length]);

  useEffect(() => {
    setCurrentMessageIndex(0);
  }, [messages.length]);

  const shouldShowStats = status === 'HAS_ACTIVITY' || status === 'NO_ACTIVITY';
  const isInactive =
    status === 'NOT_OPERATED' || status === 'OFF_SEASON' || status === 'SEASON_OPEN';
  const currentMessage = messages[currentMessageIndex % messages.length];

  // 내부 팁 (복수 시 순환)
  const internalTips: string[] = [];
  if (shouldShowStats) {
    if (stats.sentRequests >= maxPending)
      internalTips.push('보낸 요청이 수락되면 새 요청을 보낼 수 있어요');
    if (stats.receivedRequests > 0) internalTips.push('받은 요청을 수락하고 대화를 시작해보세요');
    if (stats.activeChats > 0) internalTips.push('대화를 통해 서로 잘 맞는지 알아가보세요!');
  }
  const [tipIndex, setTipIndex] = useState(0);
  useEffect(() => {
    if (internalTips.length <= 1) return;
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % internalTips.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [internalTips.length]);

  // 게이팅 상태
  if (gatingReason === 'no_building') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-5 keep-all"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[var(--knu-text-primary)]">매칭 활동</h2>
          <Lock className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
        </div>
        <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-orange-900 mb-1">건물 배정이 필요해요</h3>
              <p className="text-sm text-orange-700 leading-relaxed">
                건물을 배정해야 매칭을 시작할 수 있어요
              </p>
            </div>
          </div>
          <motion.button
            onClick={onGatedAction}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <span>건물 배정하기</span>
            <ChevronRight className="w-4 h-4" />
          </motion.button>
        </div>
        <div className="mt-4 text-xs text-[var(--knu-text-tertiary)] text-center">
          💡 건물 배정 후 바로 매칭을 시작할 수 있어요!
        </div>
      </motion.div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-5 keep-all">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-[var(--knu-text-primary)]">매칭 활동</h2>
        <TrendingUp className="w-5 h-5 text-[var(--knu-primary)]" />
      </div>

      {/* 행동 유도 메시지 */}
      {currentMessage && (
        <motion.button
          onClick={isInactive ? undefined : () => onNavigate('matching')}
          whileHover={isInactive ? undefined : { scale: 1.01 }}
          whileTap={isInactive ? undefined : { scale: 0.99 }}
          className={`w-full mb-4 p-3 bg-[var(--knu-background-alt)] rounded-xl transition-colors ${
            isInactive ? 'cursor-default' : 'hover:bg-gray-100 cursor-pointer'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="relative flex-1 h-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentMessageIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 flex items-center gap-3"
                >
                  <currentMessage.icon
                    className={`w-5 h-5 flex-shrink-0 ${currentMessage.iconColor}`}
                  />
                  <span className="text-sm font-medium text-[var(--knu-text-primary)] truncate">
                    {currentMessage.text}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>
            {!isInactive && (
              <ChevronRight className="w-5 h-5 text-[var(--knu-text-tertiary)] flex-shrink-0" />
            )}
          </div>

          {messages.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-2 h-2">
              {messages.map((_, index) => (
                <div
                  key={index}
                  className={`rounded-full transition-all ${
                    index === currentMessageIndex % messages.length
                      ? 'w-4 h-1.5 bg-[var(--knu-primary)]'
                      : 'w-1.5 h-1.5 bg-gray-300'
                  }`}
                />
              ))}
            </div>
          )}
        </motion.button>
      )}

      {/* 통계 그리드 */}
      {shouldShowStats && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {/* 보낸 요청 */}
            <motion.button
              onClick={() => onNavigate('matching')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex flex-col items-center p-3 bg-[var(--knu-background-alt)] hover:bg-amber-50 rounded-xl transition-colors group"
            >
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-xl font-bold text-amber-600">
                {stats.sentRequests}/{maxPending}
              </span>
              <span className="text-xs text-[var(--knu-text-tertiary)] mt-0.5 font-medium">
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
              onClick={() => onNavigate('matching')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex flex-col items-center p-3 bg-[var(--knu-background-alt)] hover:bg-purple-50 rounded-xl transition-colors group relative"
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
                <Bell className="w-5 h-5 text-purple-600" />
              </div>
              <AnimatedCounter
                value={stats.receivedRequests}
                className="text-xl font-bold text-purple-600"
              />
              <span className="text-xs text-[var(--knu-text-tertiary)] mt-0.5 font-medium">
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
              onClick={() => onNavigate('matching')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex flex-col items-center p-3 bg-[var(--knu-background-alt)] hover:bg-teal-50 rounded-xl transition-colors group"
            >
              <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <MessageCircle className="w-5 h-5 text-teal-600" />
              </div>
              <span className="text-xl font-bold text-teal-600">{stats.activeChats}</span>
              <span className="text-xs text-[var(--knu-text-tertiary)] mt-0.5 font-medium">
                대화 중
              </span>
              <span className="text-[10px] text-teal-600 mt-0.5">진행 중</span>
            </motion.button>
          </div>

          {/* 내부 팁 */}
          {internalTips.length > 0 && (
            <div className="mt-3 text-center relative h-4">
              <AnimatePresence mode="wait">
                <motion.p
                  key={tipIndex % internalTips.length}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                  className="absolute inset-0 text-xs text-[var(--knu-text-tertiary)]"
                >
                  💡 {internalTips[tipIndex % internalTips.length]}
                </motion.p>
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </div>
  );
}

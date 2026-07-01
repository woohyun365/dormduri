'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lightbulb,
  TrendingUp,
  MessageCircle,
  Users,
  CheckCircle,
  Calendar,
  Sparkles,
  Send,
  Info,
} from 'lucide-react';

// --- Types ---

export type TipSeasonStatus =
  | 'SEASON_MATCHING'
  | 'SEASON_MATCHING_REGISTRATION_REQUIRED'
  | 'SEASON_OPEN'
  | 'OFF_SEASON'
  | 'NOT_OPERATED'
  | 'ACTIVE_MATCH';

interface Tip {
  icon: React.ElementType;
  text: string;
  iconBg: string;
  iconText: string;
}

export interface DynamicTipBannerProps {
  seasonStatus: TipSeasonStatus;
  receivedRequests: number;
  sentRequests: number;
  activeChats: number;
  unreadMessages?: number;
}

// --- Tip generation ---

function generateTips({
  seasonStatus,
  receivedRequests,
  sentRequests,
  activeChats,
  unreadMessages = 0,
}: DynamicTipBannerProps): Tip[] {
  const tips: Tip[] = [];

  // #0 비운영
  if (seasonStatus === 'NOT_OPERATED') {
    tips.push({
      icon: Info,
      text: '서비스 운영 준비 중이에요!\n조금만 기다려주세요.',
      iconBg: 'from-gray-100 to-slate-100',
      iconText: 'text-gray-600',
    });
    return tips;
  }

  // #1 활성 매칭 (단독)
  if (seasonStatus === 'ACTIVE_MATCH') {
    tips.push({
      icon: CheckCircle,
      text: '매칭이 확정되었어요!\n호실 선택은 학교 시스템에서 진행됩니다.',
      iconBg: 'from-green-100 to-emerald-100',
      iconText: 'text-green-600',
    });
    return tips;
  }

  // #2 비시즌
  if (seasonStatus === 'OFF_SEASON') {
    tips.push({
      icon: Calendar,
      text: '비시즌에는 지난 기록과 내 정보를 확인할 수 있어요.\n다음 시즌 일정이 열리면 홈에서 다시 안내할게요.',
      iconBg: 'from-blue-100 to-cyan-100',
      iconText: 'text-blue-600',
    });
    return tips;
  }

  // #3 시즌 오픈
  if (seasonStatus === 'SEASON_OPEN') {
    tips.push({
      icon: Sparkles,
      text: '시즌이 곧 시작돼요.\n생활패턴을 미리 자세히 작성하면 좋은 룸메를 빠르게 찾을 수 있어요!',
      iconBg: 'from-purple-100 to-pink-100',
      iconText: 'text-purple-600',
    });
    return tips;
  }

  // #3-b 시즌 매칭 + registration 전 → 숨김 (MatchingSummary 게이팅 UI에서 안내)
  if (seasonStatus === 'SEASON_MATCHING_REGISTRATION_REQUIRED') {
    return tips;
  }

  // SEASON_MATCHING — 조건별 동적 팁

  // #4 받은 요청 n개+
  if (receivedRequests >= 1) {
    tips.push({
      icon: Users,
      text: `${receivedRequests}개의 매칭 요청을 받았어요!\n프로필을 꼼꼼히 확인하고 답변해보세요.`,
      iconBg: 'from-purple-100 to-pink-100',
      iconText: 'text-purple-600',
    });
  }

  // #5 / #5-b 보낸 요청
  if (sentRequests === 0) {
    tips.push({
      icon: TrendingUp,
      text: '아직 요청을 보내지 않았네요!\n생활패턴이 잘 맞는 룸메이트를 찾아보세요.',
      iconBg: 'from-orange-100 to-amber-100',
      iconText: 'text-orange-600',
    });
  } else {
    tips.push({
      icon: Send,
      text: '보낸 요청의 응답을 기다리고 있어요.\n다른 룸메 후보도 탐색해보세요!',
      iconBg: 'from-blue-100 to-cyan-100',
      iconText: 'text-blue-600',
    });
  }

  // #6 대화 중 1명+
  if (activeChats >= 1) {
    tips.push({
      icon: MessageCircle,
      text: '서로 대화가 잘 맞으면 매칭을 확정해보세요!',
      iconBg: 'from-teal-100 to-cyan-100',
      iconText: 'text-teal-600',
    });
  }

  // #6-b 읽지 않은 메시지
  if (unreadMessages > 0) {
    tips.push({
      icon: MessageCircle,
      text: `${unreadMessages}개의 읽지 않은 메시지가 있어요!\n빠른 답장이 좋은 인상을 남겨요.`,
      iconBg: 'from-rose-100 to-pink-100',
      iconText: 'text-rose-600',
    });
  }

  // #7 폴백 (정상 흐름에서 도달하지 않음)
  if (tips.length === 0) {
    tips.push({
      icon: Lightbulb,
      text: '생활패턴이 비슷한 사람과 매칭되면\n룸메이트 생활이 더 편안해져요!',
      iconBg: 'from-purple-100 to-pink-100',
      iconText: 'text-purple-600',
    });
  }

  return tips;
}

// --- Component ---

export function DynamicTipBanner(props: DynamicTipBannerProps) {
  const tips = generateTips(props);
  const tipResetKey = [
    props.seasonStatus,
    props.receivedRequests,
    props.sentRequests,
    props.activeChats,
    props.unreadMessages ?? 0,
  ].join('|');
  const [tipRotation, setTipRotation] = useState({
    index: 0,
    resetKey: tipResetKey,
  });
  const currentTipIndex = tipRotation.resetKey === tipResetKey ? tipRotation.index : 0;

  // 5초 순환 (2개 이상)
  useEffect(() => {
    if (tips.length <= 1) return;
    const interval = setInterval(() => {
      setTipRotation((prev) => ({
        resetKey: tipResetKey,
        index: prev.resetKey === tipResetKey ? (prev.index + 1) % tips.length : 1 % tips.length,
      }));
    }, 5000);
    return () => clearInterval(interval);
  }, [tipResetKey, tips.length]);

  const currentTip = tips[currentTipIndex % tips.length];
  if (!currentTip) return null;
  const Icon = currentTip.icon;

  return (
    <div className="relative keep-all h-14">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentTipIndex}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          data-active-tip-index={currentTipIndex % tips.length}
          className="absolute inset-0 flex items-start gap-2.5"
        >
          {/* 아이콘 */}
          <motion.div
            initial={{ scale: 0.8, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
            className="shrink-0"
          >
            <div
              className={`w-7 h-7 bg-linear-to-br ${currentTip.iconBg} rounded-lg flex items-center justify-center`}
            >
              <Icon className={`w-4 h-4 ${currentTip.iconText}`} />
            </div>
          </motion.div>

          {/* 텍스트 */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-(--knu-text-secondary) leading-relaxed whitespace-pre-line">
              {currentTip.text}
            </p>
          </div>

          {/* Indicator dots (우측) */}
          {tips.length > 1 && (
            <div className="flex items-center gap-1 shrink-0 pt-0.5">
              {tips.map((_, index) => (
                <motion.button
                  key={index}
                  onClick={() =>
                    setTipRotation({
                      index,
                      resetKey: tipResetKey,
                    })
                  }
                  className={`rounded-full transition-all ${
                    index === currentTipIndex % tips.length
                      ? 'w-4 h-1.5 bg-(--knu-primary)'
                      : 'w-1.5 h-1.5 bg-gray-300 hover:bg-gray-400'
                  }`}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  aria-label={`팁 ${index + 1}로 이동`}
                />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

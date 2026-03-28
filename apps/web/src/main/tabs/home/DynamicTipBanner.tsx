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
}

// --- Tip generation ---

function generateTips({
  seasonStatus,
  receivedRequests,
  sentRequests,
  activeChats,
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
      text: '비시즌에도 프로필을 완성해두면\n다음 시즌에 바로 매칭을 시작할 수 있어요.',
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

  // SEASON_MATCHING — 조건별 동적 팁

  // #4 받은 요청 4개+
  if (receivedRequests >= 4) {
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
      text: `${activeChats}명과 대화 중이에요.\n생활습관을 구체적으로 물어보면 더 잘 맞는 룸메를 찾을 수 있어요!`,
      iconBg: 'from-teal-100 to-cyan-100',
      iconText: 'text-teal-600',
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
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const tips = generateTips(props);

  // 5초 순환 (2개 이상)
  useEffect(() => {
    if (tips.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % tips.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [tips.length]);

  useEffect(() => {
    setCurrentTipIndex(0);
  }, [tips.length]);

  const currentTip = tips[currentTipIndex % tips.length];
  if (!currentTip) return null;
  const Icon = currentTip.icon;

  return (
    <div className="relative keep-all h-[3.5rem]">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentTipIndex}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 flex items-start gap-2.5"
        >
          {/* 아이콘 */}
          <motion.div
            initial={{ scale: 0.8, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
            className="flex-shrink-0"
          >
            <div
              className={`w-7 h-7 bg-gradient-to-br ${currentTip.iconBg} rounded-lg flex items-center justify-center`}
            >
              <Icon className={`w-4 h-4 ${currentTip.iconText}`} />
            </div>
          </motion.div>

          {/* 텍스트 */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-[var(--knu-text-secondary)] leading-relaxed whitespace-pre-line">
              {currentTip.text}
            </p>
          </div>

          {/* Indicator dots (우측) */}
          {tips.length > 1 && (
            <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
              {tips.map((_, index) => (
                <motion.button
                  key={index}
                  onClick={() => setCurrentTipIndex(index)}
                  className={`rounded-full transition-all ${
                    index === currentTipIndex % tips.length
                      ? 'w-4 h-1.5 bg-[var(--knu-primary)]'
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

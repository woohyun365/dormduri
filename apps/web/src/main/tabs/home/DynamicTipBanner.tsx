'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Lightbulb, TrendingUp, Users, Send } from 'lucide-react';
import { useSeasonContext } from '@/contexts/SeasonContext';

interface Tip {
  icon: React.ElementType;
  text: string;
  gradient: string;
}

export interface DynamicTipBannerProps {
  receivedRequests: number;
  sentRequests: number;
  conversationCount: number;
  hasActiveMatch: boolean;
}

export function DynamicTipBanner({
  receivedRequests,
  sentRequests,
  conversationCount,
  hasActiveMatch,
}: DynamicTipBannerProps) {
  const { state: seasonState } = useSeasonContext();
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  const tips = useMemo((): Tip[] => {
    const result: Tip[] = [];

    // 활성 매칭
    if (hasActiveMatch) {
      result.push({
        icon: TrendingUp,
        text: '매칭이 확정되었어요! 호실 선택은 학교 시스템에서 직접 진행해 주세요.',
        gradient: 'from-green-50 to-emerald-50 border-green-200',
      });
      return result;
    }

    // 비시즌
    if (seasonState === 'OFF_SEASON') {
      result.push({
        icon: Users,
        text: '비시즌에도 프로필을 완성해두면 시즌 시작 시 바로 매칭에 참여할 수 있어요.',
        gradient: 'from-blue-50 to-cyan-50 border-blue-200',
      });
      return result;
    }

    // 시즌 오픈
    if (seasonState === 'SEASON_OPEN') {
      result.push({
        icon: Users,
        text: '매칭 시즌이 곧 시작돼요. 생활패턴을 미리 입력해두세요.',
        gradient: 'from-purple-50 to-pink-50 border-purple-200',
      });
      return result;
    }

    // 시즌 매칭 중 — 상태 기반 동적 팁
    if (receivedRequests > 3) {
      result.push({
        icon: Users,
        text: `${receivedRequests}개의 매칭 요청을 받았어요! 매칭 현황에서 확인해보세요.`,
        gradient: 'from-purple-50 to-pink-50 border-purple-200',
      });
    }

    if (sentRequests === 0) {
      result.push({
        icon: Send,
        text: '아직 요청을 보내지 않았네요! 생활패턴이 잘 맞는 룸메이트를 찾아보세요.',
        gradient: 'from-orange-50 to-amber-50 border-orange-200',
      });
    }

    if (conversationCount > 0) {
      result.push({
        icon: TrendingUp,
        text: `${conversationCount}명과 대화 중이에요. 서로의 생활습관을 구체적으로 물어보세요.`,
        gradient: 'from-teal-50 to-cyan-50 border-teal-200',
      });
    }

    // 기본 팁
    if (result.length === 0) {
      result.push(
        {
          icon: Lightbulb,
          text: '생활패턴이 비슷한 사람과 매칭되면 기숙사 생활이 더 편안해져요.',
          gradient: 'from-purple-50 to-pink-50 border-purple-200',
        },
        {
          icon: Users,
          text: '생활패턴 정보를 자세히 작성할수록 나와 잘 맞는 룸메이트를 찾을 수 있어요.',
          gradient: 'from-blue-50 to-indigo-50 border-blue-200',
        },
      );
    }

    return result;
  }, [receivedRequests, sentRequests, conversationCount, hasActiveMatch, seasonState]);

  // 5초마다 팁 자동 전환
  useEffect(() => {
    if (tips.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % tips.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [tips.length]);

  // tips 변경 시 인덱스 초기화
  useEffect(() => {
    setCurrentTipIndex(0);
  }, [tips.length]);

  const currentTip = tips[currentTipIndex % tips.length];
  if (!currentTip) return null;

  const Icon = currentTip.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gradient-to-br ${currentTip.gradient} border-2 rounded-2xl p-4 relative overflow-hidden`}
    >
      <div className="relative flex items-start gap-3">
        <motion.div
          key={currentTipIndex}
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="flex-shrink-0"
        >
          <div className="w-9 h-9 bg-white/80 rounded-xl flex items-center justify-center">
            <Icon className="w-5 h-5 text-purple-600" />
          </div>
        </motion.div>

        <div className="flex-1 min-w-0">
          <motion.p
            key={currentTipIndex}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-sm text-gray-800 leading-relaxed"
          >
            {currentTip.text}
          </motion.p>

          {/* 인디케이터 dots */}
          {tips.length > 1 && (
            <div className="flex items-center gap-1.5 mt-2.5">
              {tips.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentTipIndex(index)}
                  aria-label={`팁 ${index + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    index === currentTipIndex % tips.length
                      ? 'w-5 bg-purple-500'
                      : 'w-1.5 bg-purple-300/50 hover:bg-purple-400'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

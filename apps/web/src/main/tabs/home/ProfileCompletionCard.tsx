'use client';

import { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { CheckCircle, AlertCircle, ChevronRight, Sparkles } from 'lucide-react';

interface ProfileCompletionCardProps {
  hasLifestylePattern: boolean;
  optionalFieldsCompleted: number;
  optionalFieldsTotal: number;
  missingFields?: string[];
  onCompleteProfile: () => void;
  onFieldClick?: (fieldName: string) => void;
}

export function ProfileCompletionCard({
  hasLifestylePattern,
  optionalFieldsCompleted,
  optionalFieldsTotal,
  missingFields = [],
  onCompleteProfile,
  onFieldClick,
}: ProfileCompletionCardProps) {
  const lifestyleScore = hasLifestylePattern ? 50 : 0;
  const optionalScore = (optionalFieldsCompleted / optionalFieldsTotal) * 50;
  const totalProgress = lifestyleScore + optionalScore;

  const progressMotion = useMotionValue(0);
  const _progressWidth = useTransform(progressMotion, (v) => `${v}%`);

  const [showConfetti, setShowConfetti] = useState(false);
  const [hasShownConfetti, setHasShownConfetti] = useState(false);

  useEffect(() => {
    progressMotion.set(totalProgress);
    if (totalProgress === 100 && !hasShownConfetti) {
      setShowConfetti(true);
      setHasShownConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }
  }, [totalProgress, hasShownConfetti, progressMotion]);

  const getEstimatedTime = () => {
    const remaining = optionalFieldsTotal - optionalFieldsCompleted;
    if (remaining === 0) return null;
    return `${remaining * 30}초이면 완성!`;
  };

  const estimatedTime = getEstimatedTime();
  const isFullyComplete = totalProgress === 100;

  if (isFullyComplete) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border-2 border-purple-200 p-4 relative overflow-hidden keep-all"
      >
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none z-20">
            {Array.from({ length: 20 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ x: '50%', y: '50%', scale: 0, opacity: 1 }}
                animate={{
                  x: `${Math.random() * 100}%`,
                  y: `${Math.random() * 100}%`,
                  scale: Math.random() + 0.5,
                  opacity: 0,
                  rotate: Math.random() * 360,
                }}
                transition={{ duration: 1.5 + Math.random(), ease: 'easeOut' }}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  backgroundColor: ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981'][i % 4],
                }}
              />
            ))}
          </div>
        )}

        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-pink-200/30 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
              className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center"
            >
              <Sparkles className="w-6 h-6 text-white" />
            </motion.div>
            <div className="flex-1">
              <h3 className="font-bold text-purple-900 text-lg">프로필 완성!</h3>
              <p className="text-sm text-purple-700">모든 정보가 입력되었어요</p>
            </div>
          </div>

          <div className="bg-white/60 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm text-purple-900">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>생활패턴 입력 완료</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-purple-900">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>
                선택 정보 완성 ({optionalFieldsTotal}/{optionalFieldsTotal})
              </span>
            </div>
          </div>

          <div className="mt-3 text-sm text-purple-800 bg-white/40 rounded-lg px-3 py-2">
            이제 룸메 찾기로 매칭을 시작하세요!
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-4 keep-all"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-gradient-to-br from-[var(--knu-primary)] to-blue-700 rounded-xl flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-[var(--knu-text-primary)]">프로필 완성도</h3>
          <p className="text-sm text-[var(--knu-text-secondary)]">
            {hasLifestylePattern ? '거의 다 왔어요!' : '생활패턴부터 시작해보세요'}
          </p>
        </div>
        {estimatedTime && (
          <div className="text-xs font-bold text-[var(--knu-primary)] bg-blue-50 px-2 py-1 rounded-lg">
            {estimatedTime}
          </div>
        )}
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[var(--knu-text-secondary)]">완성도</span>
          <span className="text-sm font-bold text-[var(--knu-primary)]">
            {Math.round(totalProgress)}%
          </span>
        </div>
        <div className="h-2.5 bg-[var(--knu-background-alt)] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${totalProgress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
            className="h-full bg-gradient-to-r from-[var(--knu-primary)] via-blue-500 to-blue-600 rounded-full relative overflow-hidden"
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
            />
          </motion.div>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        {hasLifestylePattern ? (
          <div className="flex items-center gap-2 text-sm text-green-900">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span>생활패턴 입력 완료</span>
          </div>
        ) : (
          <motion.button
            onClick={() => onFieldClick?.('생활패턴')}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full bg-red-50 rounded-lg p-2 border border-red-200 hover:bg-red-100 transition-colors text-left"
          >
            <div className="flex items-start gap-2 text-sm text-red-900">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span className="font-medium">생활패턴 입력이 필요해요 (필수)</span>
            </div>
          </motion.button>
        )}

        {optionalFieldsCompleted < optionalFieldsTotal && (
          <div className="bg-orange-50 rounded-lg p-2 border border-orange-200">
            <div className="flex items-start gap-2 text-sm text-orange-900 mb-2">
              <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
              <span className="font-medium">
                선택 정보 미완성 ({optionalFieldsCompleted}/{optionalFieldsTotal})
              </span>
            </div>
            {missingFields.length > 0 && (
              <div className="ml-6 text-xs text-orange-700 space-y-1">
                {missingFields.map((field, i) => (
                  <motion.button
                    key={i}
                    onClick={() => onFieldClick?.(field)}
                    whileHover={{ x: 2 }}
                    className="block hover:text-orange-900 hover:underline cursor-pointer"
                  >
                    → {field}
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        )}

        {hasLifestylePattern && optionalFieldsCompleted === optionalFieldsTotal && (
          <div className="flex items-center gap-2 text-sm text-green-900">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span>
              선택 정보 완성 ({optionalFieldsTotal}/{optionalFieldsTotal})
            </span>
          </div>
        )}
      </div>

      <motion.button
        onClick={onCompleteProfile}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full bg-[var(--knu-primary)] hover:bg-[var(--knu-primary-hover)] text-white font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        <span>프로필 {hasLifestylePattern ? '완성하기' : '입력하기'}</span>
        <ChevronRight className="w-4 h-4" />
      </motion.button>

      <div className="mt-3 text-xs text-[var(--knu-text-tertiary)] text-center">
        프로필을 완성하면 매칭 성공률이 높아져요
      </div>
    </motion.div>
  );
}

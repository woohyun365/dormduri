'use client';

import { motion } from 'motion/react';
import { Clock, CheckCircle, ChevronRight, Users, TrendingUp } from 'lucide-react';
import { AnimatedCounter } from '@/components/AnimatedCounter';

interface SeasonPreparationCardProps {
  daysUntilStart: number;
  seasonStartDate: string;
  profileCompletion: number;
  hasBuilding: boolean;
  canSelectBuilding: boolean;
  buildingOpenDate?: string;
  hasLifestylePattern: boolean;
  optionalFieldsCompleted: number;
  optionalFieldsTotal: number;
  waitingCount: number;
  onPrepare: () => void;
}

export function SeasonPreparationCard({
  daysUntilStart,
  seasonStartDate,
  profileCompletion,
  hasBuilding,
  canSelectBuilding,
  buildingOpenDate,
  hasLifestylePattern,
  optionalFieldsCompleted,
  optionalFieldsTotal,
  waitingCount,
  onPrepare,
}: SeasonPreparationCardProps) {
  const checklistItems = [
    { label: '생활패턴 입력', completed: hasLifestylePattern, required: true, waiting: false },
    {
      label: canSelectBuilding
        ? '건물 배정'
        : `건물 배정 대기${buildingOpenDate ? ` (${buildingOpenDate} 오픈)` : ''}`,
      completed: hasBuilding,
      required: true,
      waiting: !canSelectBuilding,
    },
    {
      label: `선택 정보 ${optionalFieldsCompleted}/${optionalFieldsTotal}`,
      completed: optionalFieldsCompleted === optionalFieldsTotal,
      required: false,
      waiting: false,
    },
  ];

  const completableRequiredItems = checklistItems.filter((item) => item.required && !item.waiting);
  const allReady =
    completableRequiredItems.every((item) => item.completed) &&
    (canSelectBuilding ? hasBuilding : true);

  // 색상: 건물 배정 여부 기준
  const colors = hasBuilding
    ? { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-600', iconBg: 'bg-blue-100' }
    : {
        bg: 'bg-amber-50',
        border: 'border-amber-300',
        text: 'text-amber-600',
        iconBg: 'bg-amber-100',
      };

  // CTA 문구: 미완 항목 기준
  const ctaLabel = !hasLifestylePattern
    ? '생활패턴 입력하기'
    : !hasBuilding
      ? '배정 건물 입력하기'
      : '프로필 완성하기';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-5 keep-all"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-[var(--knu-text-primary)]">매칭 활동</h2>
        <TrendingUp className="w-5 h-5 text-[var(--knu-primary)]" />
      </div>

      <div className={`${colors.bg} border-2 ${colors.border} rounded-xl p-4 mb-4`}>
        <div className="flex items-center gap-3 mb-3">
          <div
            className={`w-12 h-12 ${colors.iconBg} rounded-full flex items-center justify-center flex-shrink-0`}
          >
            <Clock className={`w-6 h-6 ${colors.text}`} />
          </div>
          <div className="flex-1">
            <h3 className={`font-bold ${colors.text} text-lg`}>매칭 시작 D-{daysUntilStart}</h3>
            <p className="text-sm text-[var(--knu-text-secondary)] mt-0.5">
              {seasonStartDate} 시작
            </p>
          </div>
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--knu-text-secondary)]">
              준비 완료도
            </span>
            <span
              className={`text-sm font-bold ${profileCompletion === 100 ? 'text-green-600' : colors.text}`}
            >
              {profileCompletion}%
            </span>
          </div>
          <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${profileCompletion}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className={`absolute left-0 top-0 h-full rounded-full ${
                profileCompletion === 100 ? 'bg-green-500' : 'bg-[var(--knu-primary)]'
              }`}
            />
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {checklistItems.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              {item.waiting ? (
                <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
              ) : item.completed ? (
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
              )}
              <span
                className={`text-sm ${
                  item.waiting
                    ? 'text-gray-500 italic'
                    : item.completed
                      ? 'text-green-600 font-medium'
                      : 'text-[var(--knu-text-secondary)]'
                }`}
              >
                {item.label}
                {item.required && !item.completed && !item.waiting && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </span>
            </div>
          ))}
        </div>

        {!allReady && canSelectBuilding && (
          <motion.button
            onClick={onPrepare}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-[var(--knu-primary)] hover:bg-[var(--knu-primary-hover)] text-white font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <span>{ctaLabel}</span>
            <ChevronRight className="w-4 h-4" />
          </motion.button>
        )}

        {allReady && (
          <div className="bg-green-100 border border-green-300 rounded-lg p-3 text-center">
            <p className="text-sm font-bold text-green-700">
              준비 완료! 시작일에 바로 매칭을 시작할 수 있어요
            </p>
          </div>
        )}

        {!canSelectBuilding && (
          <div className="bg-blue-100 border border-blue-300 rounded-lg p-3">
            <p className="text-sm text-blue-800 text-center">
              {buildingOpenDate ? `${buildingOpenDate}부터` : '곧'} 건물을 배정할 수 있어요
            </p>
          </div>
        )}
      </div>

      <div className="bg-[var(--knu-background-alt)] rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
            <Users className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <AnimatedCounter
                value={waitingCount}
                className="text-xl font-bold text-[var(--knu-text-primary)]"
              />
              <span className="text-sm text-[var(--knu-text-secondary)]">명 대기 중</span>
            </div>
            <p className="text-xs text-[var(--knu-text-tertiary)] mt-0.5">
              준비를 완료하면 시작 알림을 받아요
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

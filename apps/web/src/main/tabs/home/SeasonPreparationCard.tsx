'use client';

import { motion } from 'motion/react';
import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  Clock,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  SquarePen,
  TrendingUp,
} from 'lucide-react';
import { sectionCard, sectionHeader } from '@/main/styles/home';

interface SeasonPreparationCardProps {
  daysUntilStart: number;
  seasonStartDate: string;
  profileCompletion: number;
  hasBuilding: boolean;
  canSelectBuilding: boolean;
  buildingOpenDate?: string;
  hasLifestylePattern: boolean;
  onPrepare: () => void;
  missingFields?: string[];
}

export function SeasonPreparationCard({
  daysUntilStart,
  seasonStartDate,
  profileCompletion,
  hasBuilding,
  canSelectBuilding,
  buildingOpenDate,
  hasLifestylePattern,
  onPrepare,
  missingFields,
}: SeasonPreparationCardProps) {
  const optionalFieldsTotal = ALL_OPTIONAL_FIELDS.length;
  const optionalFieldsCompleted =
    optionalFieldsTotal - (missingFields?.length ?? optionalFieldsTotal);
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
      className={sectionCard()}
    >
      <div className={sectionHeader}>
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

        <ChecklistSection
          checklistItems={checklistItems}
          missingFields={missingFields}
          onPrepare={onPrepare}
        />

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

        {!canSelectBuilding && (
          <div className="bg-blue-100 border border-blue-300 rounded-lg p-3">
            <p className="text-sm text-blue-800 text-center">
              {buildingOpenDate ? `${buildingOpenDate}부터` : '곧'} 건물을 배정할 수 있어요
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// --- 체크리스트 서브 컴포넌트 ---

interface ChecklistItem {
  label: string;
  completed: boolean;
  required: boolean;
  waiting: boolean;
}

const ALL_OPTIONAL_FIELDS = ['룸메에게 한마디', '단대', '학년', 'MBTI', '출생연도'];

function ChecklistSection({
  checklistItems,
  missingFields,
  onPrepare,
}: {
  checklistItems: ChecklistItem[];
  missingFields?: string[];
  onPrepare: () => void;
}) {
  const [optionalExpanded, setOptionalExpanded] = useState(false);
  const missing = missingFields ?? [];

  return (
    <>
      <div className="space-y-2 mb-4">
        {checklistItems.map((item, index) => {
          const isOptional = item.label.startsWith('선택 정보');

          return (
            <div key={index}>
              {/* 선택 정보: 전체 행이 토글 */}
              {isOptional ? (
                <button
                  onClick={() => setOptionalExpanded(!optionalExpanded)}
                  className="w-full flex items-center gap-2"
                >
                  {item.completed ? (
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  ) : (
                    <CircleDot className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  )}
                  <span
                    className={`text-sm flex-1 text-left ${
                      item.completed
                        ? 'text-green-600 font-medium'
                        : 'text-[var(--knu-text-secondary)]'
                    }`}
                  >
                    {item.label}
                  </span>
                  <motion.div
                    animate={{ rotate: optionalExpanded ? -90 : 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="text-[var(--knu-text-tertiary)] flex-shrink-0"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </motion.div>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  {item.waiting ? (
                    <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  ) : item.completed ? (
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  ) : (
                    <CircleDot className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  )}
                  <span
                    className={`text-sm flex-1 ${
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
                  {item.label === '생활패턴 입력' && item.completed && (
                    <motion.button
                      onClick={onPrepare}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="text-xs font-medium text-[var(--knu-primary)] hover:underline flex-shrink-0"
                    >
                      수정하기
                    </motion.button>
                  )}
                </div>
              )}

              {/* 선택 정보 필드 목록 (펼치기/접기) */}
              {isOptional && (
                <AnimatePresence>
                  {optionalExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="ml-6 mt-1.5 text-xs space-y-1">
                        {ALL_OPTIONAL_FIELDS.map((field, i) => {
                          const isCompleted = !missing.includes(field);
                          return (
                            <div key={i} className="flex items-center gap-1.5">
                              {isCompleted ? (
                                <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
                              ) : (
                                <CircleDot className="w-3 h-3 text-gray-300 flex-shrink-0" />
                              )}
                              <span
                                className={
                                  isCompleted ? 'text-green-600' : 'text-[var(--knu-text-tertiary)]'
                                }
                              >
                                {field}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          );
        })}
      </div>

      {/* 헬퍼 텍스트 */}
      <div className="flex items-start gap-1.5 mb-4 text-xs text-[var(--knu-text-tertiary)]">
        <SquarePen className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>새 학기, 달라진 생활패턴이 있다면 미리 수정해두세요!</span>
      </div>
    </>
  );
}

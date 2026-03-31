'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { motion } from 'motion/react';

interface ShowMoreButtonProps {
  /** 현재 미표시 잔여 개수 */
  remainingCount: number;
  /** 전체 펼쳐진 상태인지 */
  isExpanded: boolean;
  /** 전체 아이템 수 (초기 표시 수 이하면 버튼 숨김) */
  totalCount?: number;
  /** 초기 표시 수 (totalCount와 비교용) */
  initialCount?: number;
  onClick: () => void;
}

export function ShowMoreButton({
  remainingCount,
  isExpanded,
  totalCount,
  initialCount,
  onClick,
}: ShowMoreButtonProps) {
  // 전체 개수가 초기 표시 수 이하면 버튼 불필요
  if (totalCount !== undefined && initialCount !== undefined && totalCount <= initialCount) {
    return null;
  }

  if (remainingCount <= 0 && !isExpanded) return null;

  return (
    <motion.button
      onClick={onClick}
      className="w-full mt-2 py-3 px-4 rounded-2xl bg-white border-2 border-[var(--knu-border)] hover:border-[var(--knu-primary)] transition-all duration-200 flex items-center justify-center gap-2 text-[var(--knu-text-secondary)] hover:text-[var(--knu-text-primary)] group"
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      {isExpanded ? (
        <>
          <ChevronUp className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" />
          <span className="text-sm font-medium">접기</span>
        </>
      ) : (
        <>
          <span className="text-sm font-medium">{remainingCount}개 더보기</span>
          <ChevronDown className="w-4 h-4 transition-transform group-hover:translate-y-0.5" />
        </>
      )}
    </motion.button>
  );
}

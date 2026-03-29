'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { motion } from 'motion/react';

interface ShowMoreButtonProps {
  remainingCount: number;
  isExpanded: boolean;
  onClick: () => void;
}

export function ShowMoreButton({ remainingCount, isExpanded, onClick }: ShowMoreButtonProps) {
  if (remainingCount <= 0 && !isExpanded) return null;

  return (
    <motion.button
      onClick={onClick}
      className="w-full mt-2 py-3 px-4 rounded-2xl bg-white/60 backdrop-blur-sm border border-[var(--knu-border)] hover:bg-white/80 transition-all duration-200 flex items-center justify-center gap-2 text-[var(--knu-text-secondary)] hover:text-[var(--knu-text-primary)] group"
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

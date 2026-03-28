'use client';

import { motion } from 'motion/react';
import { Sparkles, ChevronRight, AlertCircle } from 'lucide-react';

interface ProfileManagementCardProps {
  onUpdateProfile: () => void;
  missingFields?: string[];
  standalone?: boolean;
}

export function ProfileManagementCard({
  onUpdateProfile,
  missingFields = [],
  standalone = false,
}: ProfileManagementCardProps) {
  const hasIncomplete = missingFields.length > 0;

  return (
    <div
      className={standalone ? 'keep-all' : 'border-t border-[var(--knu-border)] pt-4 mt-4 keep-all'}
    >
      <h3 className="text-sm font-bold text-[var(--knu-text-primary)] mb-3 flex items-center gap-1.5">
        <Sparkles className="w-4 h-4 text-[var(--knu-primary)]" />
        프로필 관리
      </h3>

      {hasIncomplete && (
        <div className="bg-orange-50 rounded-lg p-2.5 border border-orange-200 mb-3">
          <div className="flex items-start gap-2 text-sm text-orange-900 mb-1.5">
            <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
            <span className="font-medium">선택 정보 미완성 ({5 - missingFields.length}/5)</span>
          </div>
          <div className="ml-6 text-xs text-orange-700 space-y-0.5">
            {missingFields.map((field, i) => (
              <div key={i}>→ {field}</div>
            ))}
          </div>
        </div>
      )}

      <p className="text-sm text-[var(--knu-text-secondary)] leading-relaxed mb-3">
        새 학기, 달라진 생활패턴이 있다면 미리 수정해두세요!
      </p>

      <motion.button
        onClick={onUpdateProfile}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full bg-[var(--knu-primary)] hover:bg-[var(--knu-primary-hover)] text-white font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        <span>{hasIncomplete ? '프로필 완성하기' : '프로필 수정하기'}</span>
        <ChevronRight className="w-4 h-4" />
      </motion.button>
    </div>
  );
}

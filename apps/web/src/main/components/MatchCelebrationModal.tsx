'use client';

import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { Button } from '@/components/Button';
import { Z_INDEX } from '@/constants/ui';

interface MatchCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  partnerNickname: string;
  matchScore: number;
}

export function MatchCelebrationModal({
  isOpen,
  onClose,
  partnerNickname,
  matchScore,
}: MatchCelebrationModalProps) {
  useBodyScrollLock(isOpen);
  const containerRef = useFocusTrap(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-5"
      style={{ zIndex: Z_INDEX.toast }}
      role="alertdialog"
      aria-modal="true"
      aria-label="매칭 성사"
      ref={containerRef}
      tabIndex={-1}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🎉</span>
        </div>
        <h3 className="text-lg font-bold text-[var(--knu-text-primary)] mb-2">매칭 성사!</h3>
        <p className="text-sm text-[var(--knu-text-secondary)] leading-relaxed mb-1">
          <span className="font-semibold text-[var(--knu-primary)]">{partnerNickname}</span>님과
          매칭되었어요!
        </p>
        <p className="text-sm text-[var(--knu-text-tertiary)] mb-6">매칭도 {matchScore}%</p>

        <Button variant="primary" fullWidth onClick={onClose}>
          확인
        </Button>
      </div>
    </div>
  );
}

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
  kind?: 'pair' | 'pair_final' | 'group_final';
}

export function MatchCelebrationModal({
  isOpen,
  onClose,
  partnerNickname,
  matchScore,
  kind = 'pair',
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
        <div
          className={`w-16 h-16 ${kind === 'group_final' ? 'bg-blue-100' : 'bg-green-100'} rounded-full flex items-center justify-center mx-auto mb-4`}
        >
          <span className="text-3xl">🎉</span>
        </div>
        <h3 className="text-lg font-bold text-[var(--knu-text-primary)] mb-2">
          {kind === 'group_final'
            ? '3인 그룹 확정!'
            : kind === 'pair_final'
              ? '2인 그룹 마감 완료!'
              : '매칭 성사!'}
        </h3>
        <p className="text-sm text-[var(--knu-text-secondary)] leading-relaxed mb-1">
          {kind === 'group_final' ? (
            '세 명 모두가 최종 확정을 완료했어요!'
          ) : kind === 'pair_final' ? (
            <>
              <span className="font-semibold text-[var(--knu-primary)]">{partnerNickname}</span>님과
              2인으로 그룹을 마감했어요!
            </>
          ) : (
            <>
              <span className="font-semibold text-[var(--knu-primary)]">{partnerNickname}</span>님과
              매칭되었어요!
            </>
          )}
        </p>
        {kind !== 'group_final' && (
          <p className="text-sm text-[var(--knu-text-tertiary)] mb-6">매칭도 {matchScore}%</p>
        )}
        {kind === 'group_final' && (
          <p className="text-sm text-[var(--knu-text-tertiary)] mb-6">
            이제 더 이상 합류 요청을 받지 않는 최종 3인실 그룹이에요.
          </p>
        )}

        <Button variant="primary" fullWidth onClick={onClose}>
          확인
        </Button>
      </div>
    </div>
  );
}

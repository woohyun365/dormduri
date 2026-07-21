'use client';

import { useState } from 'react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { Button } from '@/components/ui/Button';
import { Z_INDEX, MESSAGE_MAX_LENGTH } from '@/constants/ui';

interface MatchRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (message: string | null) => void;
  targetNickname: string;
}

export function MatchRequestDialog({
  isOpen,
  onClose,
  onConfirm,
  targetNickname,
}: MatchRequestDialogProps) {
  const [message, setMessage] = useState('');
  useBodyScrollLock(isOpen);
  const containerRef = useFocusTrap(isOpen, onClose);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const trimmed = message.trim();
    onConfirm(trimmed.length > 0 ? trimmed : null);
    setMessage('');
    onClose();
  };

  const handleClose = () => {
    setMessage('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-5"
      style={{ zIndex: Z_INDEX.toast }}
      role="alertdialog"
      aria-modal="true"
      aria-label="매칭 요청"
      ref={containerRef}
      tabIndex={-1}
    >
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <h3 className="text-lg font-bold text-[var(--knu-text-primary)] mb-2">매칭 요청</h3>
        <p className="text-sm text-[var(--knu-text-secondary)] leading-relaxed mb-4">
          {targetNickname}님에게 매칭 요청을 보내시겠습니까?
        </p>

        <div className="mb-6">
          <textarea
            value={message}
            onChange={(e) => {
              if (e.target.value.length <= MESSAGE_MAX_LENGTH) {
                setMessage(e.target.value);
              }
            }}
            placeholder="한마디 남기기 (선택)"
            maxLength={MESSAGE_MAX_LENGTH}
            rows={3}
            className="w-full px-3 py-2.5 border-2 border-[var(--knu-border)] rounded-xl text-sm text-[var(--knu-text-primary)] placeholder:text-[var(--knu-text-tertiary)] resize-none focus:outline-none focus:border-[var(--knu-primary)] transition-colors"
          />
          <p className="text-xs text-[var(--knu-text-tertiary)] text-right mt-1">
            {message.length}/{MESSAGE_MAX_LENGTH}
          </p>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <Button variant="outline" fullWidth onClick={handleClose}>
              취소
            </Button>
          </div>
          <div className="flex-1">
            <Button variant="primary" fullWidth onClick={handleConfirm}>
              요청 보내기
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

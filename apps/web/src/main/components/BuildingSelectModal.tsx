'use client';

import { useState } from 'react';
import { Building2, Check, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { getAvailableDormitories, UNASSIGNED_ID } from '@/constants/dormitory';
import type { Campus } from '@/types/profile';

interface BuildingSelectModalProps {
  campus: Campus;
  gender: 'M' | 'F';
  onSelect: (dormitoryId: string) => void;
  onClose?: () => void;
}

export function BuildingSelectModal({
  campus,
  gender,
  onSelect,
  onClose,
}: BuildingSelectModalProps) {
  useBodyScrollLock(true);
  const containerRef = useFocusTrap(true, onClose ?? (() => {}));

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dormitories = getAvailableDormitories(campus, gender);

  const handleConfirm = () => {
    if (selectedId) {
      onSelect(selectedId);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-white flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="배정 건물 선택"
      ref={containerRef}
      tabIndex={-1}
    >
      {onClose && (
        <div className="flex justify-end px-5 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5 text-[var(--knu-text-secondary)]" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-5 py-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[var(--knu-primary-light)] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-[var(--knu-primary)]" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--knu-text-primary)] mb-2">
              배정 건물을 선택해주세요
            </h1>
            <p className="text-sm text-[var(--knu-text-secondary)] leading-relaxed">
              배정받은 기숙사 건물을 선택하면
              <br />
              같은 건물 룸메이트를 찾을 수 있어요
            </p>
          </div>

          <div className="space-y-3">
            {/* Unassigned option */}
            <button
              type="button"
              onClick={() => setSelectedId(UNASSIGNED_ID)}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                selectedId === UNASSIGNED_ID
                  ? 'border-orange-400 bg-orange-50'
                  : 'border-dashed border-[var(--knu-border)] bg-[var(--knu-background-alt)] hover:border-gray-300'
              }`}
            >
              <span className="font-semibold text-[var(--knu-text-secondary)]">
                아직 배정받지 않았어요
              </span>
              {selectedId === UNASSIGNED_ID && (
                <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </button>

            {/* Warning when unassigned selected */}
            {selectedId === UNASSIGNED_ID && (
              <div className="flex items-start gap-3 p-4 bg-orange-50 border-2 border-orange-200 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-orange-800 mb-1">일부 기능이 제한돼요</p>
                  <p className="text-xs text-orange-700 leading-relaxed">
                    건물이 정해지지 않으면 같은 건물 룸메이트 매칭이 어려워요. 배정 후 언제든 변경할
                    수 있어요.
                  </p>
                </div>
              </div>
            )}

            {/* Dormitory list */}
            {dormitories.map((dorm) => (
              <button
                key={dorm.id}
                type="button"
                onClick={() => setSelectedId(dorm.id)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                  selectedId === dorm.id
                    ? 'border-[var(--knu-primary)] bg-[var(--knu-primary-light)]'
                    : 'border-[var(--knu-border)] bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-[var(--knu-text-primary)]">{dorm.name}</span>
                  <Chip label={`${dorm.roomType}인실`} variant="badge" />
                </div>
                {selectedId === dorm.id && (
                  <div className="w-6 h-6 bg-[var(--knu-primary)] rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="mt-6 bg-blue-50 border-2 border-blue-100 rounded-xl p-4">
            <p className="text-sm text-blue-900">
              나중에 <strong>프로필 설정</strong>에서 변경할 수 있어요.
            </p>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 bg-white border-t-2 border-[var(--knu-border)] px-5 py-4">
        <div className="max-w-md mx-auto">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!selectedId}
            onClick={handleConfirm}
          >
            선택 완료
          </Button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Chip } from '@/components/Chip';
import { Button } from '@/components/Button';
import { BaseBottomSheet } from '@/components/BaseBottomSheet';
import { LIFESTYLE_LABELS, LIFESTYLE_FIELD_NAMES } from '@/constants/lifestyle';
import type { LifestyleData } from '@/types/lifestyle';

interface LifestyleEditSheetProps {
  isOpen: boolean;
  onClose: () => void;
  lifestyle: LifestyleData;
  onSave: (lifestyle: LifestyleData) => void;
}

type FieldKey = keyof LifestyleData;

const FIELD_ORDER: FieldKey[] = [
  // 수면 패턴
  'bedtime',
  'wakeTime',
  'sleepHabit',
  'sleepEnvironment',
  'nightStudyLight',
  'noiseSensitivity',
  // 생활 패턴
  'smokingBehavior',
  'indoorEating',
  'phoneBehavior',
  'earphoneUsage',
  'cleanLevel',
  'drinkingFrequency',
  'relationshipStyle',
  'temperatureSensitivity',
  // 원하는 룸메 조건
  'smokingTolerance',
  'phoneTolerance',
  'earphoneExpectation',
  'sleepEnvPreference',
  'cleanExpectation',
  'drinkingTolerance',
  'nightLightTolerance',
];

const DRINKING_FIELDS: FieldKey[] = ['drinkingFrequency', 'drinkingTolerance'];

export function LifestyleEditSheet({
  isOpen,
  onClose,
  lifestyle,
  onSave,
}: LifestyleEditSheetProps) {
  const [draft, setDraft] = useState<LifestyleData>(lifestyle);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setDraft(lifestyle);
    }
  }

  const handleToggle = (field: FieldKey, value: string) => {
    setDraft((prev) => ({
      ...prev,
      [field]: prev[field] === value ? null : value,
    }));
  };

  const handleSave = () => {
    // Ensure required fields are not null — keep original value if user deselected
    const safeDraft: Record<string, string | null> = { ...draft };
    for (const field of FIELD_ORDER) {
      if (safeDraft[field] === null) {
        safeDraft[field] = lifestyle[field];
      }
    }
    onSave(safeDraft as unknown as LifestyleData);
    onClose();
  };

  return (
    <BaseBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="생활패턴 수정"
      footer={
        <div className="flex gap-3">
          <div className="flex-1">
            <Button variant="outline" fullWidth onClick={onClose}>
              취소
            </Button>
          </div>
          <div className="flex-1">
            <Button variant="primary" fullWidth onClick={handleSave}>
              저장하기
            </Button>
          </div>
        </div>
      }
    >
      <div className="p-5 space-y-6 pb-5">
        {FIELD_ORDER.map((field) => {
          const labels = LIFESTYLE_LABELS[field];
          const isDrinking = DRINKING_FIELDS.includes(field);
          return (
            <div key={field}>
              <label className="block text-sm font-semibold text-[var(--knu-text-primary)] mb-3">
                {LIFESTYLE_FIELD_NAMES[field]}
              </label>
              {isDrinking && (
                <p className="text-xs text-[var(--knu-text-tertiary)] mb-2">
                  매칭 점수에만 반영되며 상대방에게는 표시되지 않아요
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {Object.entries(labels).map(([value, label]) => (
                  <Chip
                    key={value}
                    label={label}
                    selected={draft[field] === value}
                    onClick={() => handleToggle(field, value)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </BaseBottomSheet>
  );
}

'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Chip } from '@/components/Chip';
import { Button } from '@/components/Button';
import { BaseBottomSheet } from '@/components/BaseBottomSheet';
import { useSeasonContext } from '@/contexts/SeasonContext';
import {
  LIFESTYLE_LABELS,
  LIFESTYLE_FIELD_NAMES,
  SLEEP_FIELDS,
  LIVING_FIELDS,
  CONDITION_FIELDS,
} from '@/constants/lifestyle';
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
];

const DRINKING_FIELDS: FieldKey[] = ['drinkingFrequency', 'drinkingTolerance'];

const SLEEP_FIELD_SET = new Set<FieldKey>(SLEEP_FIELDS);
const LIVING_FIELD_SET = new Set<FieldKey>(LIVING_FIELDS);
const CONDITION_FIELD_SET = new Set<FieldKey>(CONDITION_FIELDS);

function getFieldLockState(
  field: FieldKey,
  isSeasonLocked: boolean,
): { locked: boolean; reason?: string } {
  if (!isSeasonLocked) return { locked: false };

  // 시즌 중: 수면 + 생활 고정
  if (SLEEP_FIELD_SET.has(field) || LIVING_FIELD_SET.has(field)) {
    return { locked: true, reason: '시즌 중에는 변경할 수 없어요' };
  }

  // 시즌 중: 음주 2필드 고정 (조건이지만 별도 잠금)
  if (DRINKING_FIELDS.includes(field)) {
    return { locked: true, reason: '시즌 중에는 변경할 수 없어요' };
  }

  // 시즌 중: 조건 7개 (음주 제외) 수정 가능
  if (CONDITION_FIELD_SET.has(field)) {
    return { locked: false };
  }

  return { locked: false };
}

export function LifestyleEditSheet({
  isOpen,
  onClose,
  lifestyle,
  onSave,
}: LifestyleEditSheetProps) {
  const { isMatching: isSeasonLocked } = useSeasonContext();
  const [draft, setDraft] = useState<LifestyleData>(lifestyle);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setDraft(lifestyle);
    }
  }

  const handleToggle = (field: FieldKey, value: string) => {
    const { locked } = getFieldLockState(field, isSeasonLocked);
    if (locked) return;

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
          const { locked, reason } = getFieldLockState(field, isSeasonLocked);
          return (
            <div key={field}>
              <label className="block text-sm font-semibold text-[var(--knu-text-primary)] mb-3">
                {LIFESTYLE_FIELD_NAMES[field]}
                {locked && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-gray-400">
                    <Lock className="w-3 h-3" />
                    {reason}
                  </span>
                )}
              </label>
              {isDrinking && !locked && (
                <p className="text-xs text-[var(--knu-text-tertiary)] mb-2">
                  매칭 점수에만 반영되며 상대방에게는 표시되지 않아요
                </p>
              )}
              <div className={`flex flex-wrap gap-2 ${locked ? 'opacity-50' : ''}`}>
                {Object.entries(labels).map(([value, label]) => (
                  <Chip
                    key={value}
                    label={label}
                    selected={draft[field] === value}
                    onClick={locked ? undefined : () => handleToggle(field, value)}
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

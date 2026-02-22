'use client';

import { Chip } from '@/components/Chip';
import { Button } from '@/components/Button';
import { BaseBottomSheet } from '@/components/BaseBottomSheet';
import { LIFESTYLE_LABELS, LIFESTYLE_FIELD_NAMES } from '@/constants/lifestyle';
import type { FilterState } from '@/types/filter';
export { DEFAULT_FILTERS } from '@/types/filter';
export type { FilterState } from '@/types/filter';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onApply: () => void;
  onReset: () => void;
}

type FilterField = keyof FilterState;

const FILTER_FIELDS: FilterField[] = [
  'smoker',
  'sleepHabit',
  'indoorEating',
  'bedtime',
  'wakeTime',
  'noiseSensitivity',
  'cleanliness',
  'relationshipStyle',
];

export function BottomSheet({
  isOpen,
  onClose,
  filters,
  onFilterChange,
  onApply,
  onReset,
}: BottomSheetProps) {
  const handleToggle = (field: FilterField, value: string) => {
    onFilterChange({
      ...filters,
      [field]: filters[field] === value ? null : value,
    });
  };

  return (
    <BaseBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="원하는 룸메 조건"
      footer={
        <div className="flex gap-3">
          <div className="flex-1">
            <Button variant="outline" fullWidth onClick={onReset}>
              초기화
            </Button>
          </div>
          <div className="flex-1">
            <Button variant="primary" fullWidth onClick={onApply}>
              적용하기
            </Button>
          </div>
        </div>
      }
    >
      <div className="p-5 space-y-6 pb-5">
        {FILTER_FIELDS.map((field) => {
          const labels =
            field === 'sleepHabit' ? { NONE: '없음', HAS: '있음' } : LIFESTYLE_LABELS[field];
          return (
            <div key={field}>
              <label className="block text-sm font-semibold text-[var(--knu-text-primary)] mb-3">
                {LIFESTYLE_FIELD_NAMES[field]}
              </label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(labels).map(([value, label]) => (
                  <Chip
                    key={value}
                    label={label}
                    selected={filters[field] === value}
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

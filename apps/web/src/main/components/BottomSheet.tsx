'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Chip } from '@/components/Chip';
import { Button } from '@/components/Button';
import { LIFESTYLE_LABELS, LIFESTYLE_FIELD_NAMES } from '@/constants/lifestyle';
import type { LifestyleData } from '@/signup/components/StepLifestyleProfile';

export interface FilterState {
  smoker: LifestyleData['smoker'];
  bedtime: LifestyleData['bedtime'];
  wakeTime: LifestyleData['wakeTime'];
  noiseSensitivity: LifestyleData['noiseSensitivity'];
  cleanliness: LifestyleData['cleanliness'];
  sleepHabit: LifestyleData['sleepHabit'];
  indoorEating: LifestyleData['indoorEating'];
  relationshipStyle: LifestyleData['relationshipStyle'];
}

export const DEFAULT_FILTERS: FilterState = {
  smoker: null,
  bedtime: null,
  wakeTime: null,
  noiseSensitivity: null,
  cleanliness: null,
  sleepHabit: null,
  indoorEating: null,
  relationshipStyle: null,
};

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
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggle = (field: FilterField, value: string) => {
    onFilterChange({
      ...filters,
      [field]: filters[field] === value ? null : value,
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[var(--knu-border)] px-5 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[var(--knu-text-primary)]">필터</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--knu-background-alt)] transition-colors"
          >
            <X className="w-6 h-6 text-[var(--knu-text-secondary)]" />
          </button>
        </div>

        <div className="p-5 space-y-6 pb-5">
          {FILTER_FIELDS.map((field) => {
            const labels = LIFESTYLE_LABELS[field];
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

        {/* Sticky Bottom Buttons */}
        <div className="sticky bottom-0 bg-white border-t border-[var(--knu-border)] p-5 flex gap-3">
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
      </div>
    </div>
  );
}

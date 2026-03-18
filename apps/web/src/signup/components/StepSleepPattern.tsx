'use client';

import { useCallback, useRef, useState } from 'react';
import { Moon } from 'lucide-react';
import { StepHeader } from '@/components/StepHeader';
import { StepNavigation } from '@/components/form/StepNavigation';
import { ChipSelectField } from '@/components/form/ChipSelectField';
import { LIFESTYLE_LABELS, LIFESTYLE_FIELD_NAMES, SLEEP_FIELDS } from '@/constants/lifestyle';
import type { LifestyleData } from '@/types/lifestyle';

interface StepSleepPatternProps {
  lifestyle: LifestyleData;
  onUpdate: (field: keyof LifestyleData, value: string) => void;
  onNext: () => void;
  onBack: () => void;
}

type SleepField = (typeof SLEEP_FIELDS)[number];

const SLEEP_ERROR_LABELS: Record<string, string> = {
  bedtime: '취침 시간을 선택해주세요.',
  wakeTime: '기상 시간을 선택해주세요.',
  sleepHabit: '잠버릇을 선택해주세요.',
  sleepEnvironment: '수면 환경을 선택해주세요.',
  nightStudyLight: '밤 공부 시 불빛을 선택해주세요.',
  noiseSensitivity: '잠귀를 선택해주세요.',
};

export function StepSleepPattern({ lifestyle, onUpdate, onNext, onBack }: StepSleepPatternProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const setFieldRef = useCallback(
    (field: SleepField) => (el: HTMLDivElement | null) => {
      fieldRefs.current[field] = el;
    },
    [],
  );

  const handleNext = () => {
    const newErrors: Record<string, string> = {};

    for (const field of SLEEP_FIELDS) {
      if (!lifestyle[field]) {
        newErrors[field] = SLEEP_ERROR_LABELS[field] ?? '선택해주세요.';
      }
    }

    setErrors(newErrors);

    const firstError = SLEEP_FIELDS.find((f) => newErrors[f]);
    if (firstError) {
      fieldRefs.current[firstError]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    onNext();
  };

  const handleChange = (field: SleepField, value: string | null) => {
    if (value === null) return;
    onUpdate(field, value);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <StepHeader
        icon={<Moon className="w-8 h-8 text-[var(--knu-primary)]" />}
        title="수면 패턴"
        description="수면 습관에 대해 알려주세요"
      />

      <div className="space-y-8">
        {SLEEP_FIELDS.map((field) => (
          <div key={field} ref={setFieldRef(field)}>
            <ChipSelectField
              label={LIFESTYLE_FIELD_NAMES[field]}
              options={LIFESTYLE_LABELS[field]}
              value={lifestyle[field]}
              onChange={(value) => handleChange(field, value)}
              error={errors[field]}
              required
            />
          </div>
        ))}
      </div>

      <StepNavigation onBack={onBack} onNext={handleNext} />
    </div>
  );
}

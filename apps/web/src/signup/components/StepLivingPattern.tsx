'use client';

import { useCallback, useRef, useState } from 'react';
import { Home } from 'lucide-react';
import { StepHeader } from '@/components/StepHeader';
import { StepNavigation } from '@/components/form/StepNavigation';
import { ChipSelectField } from '@/components/form/ChipSelectField';
import { LIFESTYLE_LABELS, LIFESTYLE_FIELD_NAMES, LIVING_FIELDS } from '@/constants/lifestyle';
import type { LifestyleData } from '@/types/lifestyle';

interface StepLivingPatternProps {
  lifestyle: LifestyleData;
  onUpdate: (field: keyof LifestyleData, value: string) => void;
  onNext: () => void;
  onBack: () => void;
}

type LivingField = (typeof LIVING_FIELDS)[number];

const LIVING_ERROR_LABELS: Record<string, string> = {
  smokingBehavior: '흡연 여부를 선택해주세요.',
  indoorEating: '실내 취식 여부를 선택해주세요.',
  phoneBehavior: '통화 방식을 선택해주세요.',
  earphoneUsage: '이어폰 사용을 선택해주세요.',
  cleanLevel: '청소 빈도를 선택해주세요.',
  drinkingFrequency: '음주 빈도를 선택해주세요.',
  relationshipStyle: '관계 스타일을 선택해주세요.',
  temperatureSensitivity: '온도 민감도를 선택해주세요.',
};

export function StepLivingPattern({ lifestyle, onUpdate, onNext, onBack }: StepLivingPatternProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const setFieldRef = useCallback(
    (field: LivingField) => (el: HTMLDivElement | null) => {
      fieldRefs.current[field] = el;
    },
    [],
  );

  const handleNext = () => {
    const newErrors: Record<string, string> = {};

    for (const field of LIVING_FIELDS) {
      if (!lifestyle[field]) {
        newErrors[field] = LIVING_ERROR_LABELS[field] ?? '선택해주세요.';
      }
    }

    setErrors(newErrors);

    const firstError = LIVING_FIELDS.find((f) => newErrors[f]);
    if (firstError) {
      fieldRefs.current[firstError]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    onNext();
  };

  const handleChange = (field: LivingField, value: string | null) => {
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
        icon={<Home className="w-8 h-8 text-[var(--knu-primary)]" />}
        title="생활 패턴"
        description="생활 습관에 대해 알려주세요"
      />

      <div className="space-y-8">
        {LIVING_FIELDS.map((field) => (
          <div key={field} ref={setFieldRef(field)}>
            <ChipSelectField
              label={LIFESTYLE_FIELD_NAMES[field]}
              options={LIFESTYLE_LABELS[field]}
              value={lifestyle[field]}
              onChange={(value) => handleChange(field, value)}
              error={errors[field]}
              required
            />
            {field === 'drinkingFrequency' && (
              <p className="mt-2 text-xs text-[var(--knu-text-tertiary)]">
                음주 정보는 매칭 점수에만 반영되며, 상대 프로필에 표시되지 않습니다
              </p>
            )}
          </div>
        ))}
      </div>

      <StepNavigation onBack={onBack} onNext={handleNext} />
    </div>
  );
}

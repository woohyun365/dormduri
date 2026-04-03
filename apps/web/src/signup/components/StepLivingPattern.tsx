'use client';

import { useCallback, useRef, useState } from 'react';
import { Home } from 'lucide-react';
import { StepHeader } from '@/components/StepHeader';
import { StepNavigation } from '@/components/form/StepNavigation';
import { ChipSelectField } from '@/components/form/ChipSelectField';
import { DrinkingPrivacyNote } from '@/components/form/DrinkingPrivacyNote';
import { LIFESTYLE_LABELS, LIFESTYLE_FIELD_NAMES, LIVING_FIELDS } from '@/constants/lifestyle';
import type { LifestyleData } from '@/types/lifestyle';
import { focusAndScroll } from '@/utils/focus';

interface StepLivingPatternProps {
  lifestyle: LifestyleData;
  onUpdate: (field: keyof LifestyleData, value: string) => void;
  onNext: () => void;
  onBack: () => void;
}

type LivingField = (typeof LIVING_FIELDS)[number];

const LIVING_ERROR_LABELS: Record<string, string> = {
  smokingBehavior: '흡연 여부를 선택해주세요.',
  indoorEating: '실내 취식을 선택해주세요.',
  phoneBehavior: '통화 방식을 선택해주세요.',
  earphoneUsage: '소리 출력 방식을 선택해주세요.',
  cleanLevel: '청소 빈도를 선택해주세요.',
  drinkingFrequency: '음주 빈도를 선택해주세요.',
  relationshipStyle: '관계 스타일을 선택해주세요.',
  temperatureSensitivity: '온도 민감도를 선택해주세요.',
};

const LIVING_HELPER_TEXTS: Record<string, string> = {
  smokingBehavior: '현재 흡연 상태를 선택해주세요.',
  indoorEating: '방에서 음식을 먹는 편인가요?',
  phoneBehavior: '전화, 디스코드 등 음성 대화를 방에서 하나요?',
  earphoneUsage: '영상, 음악, 강의 등 들을 때 어떻게 듣나요?',
  cleanLevel: '청소, 정리정돈, 머리카락 치우기 등 얼마나 신경 쓰나요?',
  drinkingFrequency: '술 약속에 얼마나 참여하시나요?',
  relationshipStyle: '룸메이트와 어떤 관계를 원하나요?',
  temperatureSensitivity: '에어컨/난방에 민감한 편인가요?',
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
      focusAndScroll(fieldRefs.current[firstError]);
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
        description="나의 생활 습관을 알려주세요"
      />

      <div className="space-y-8">
        {LIVING_FIELDS.map((field) => (
          <div key={field} ref={setFieldRef(field)} tabIndex={-1}>
            <ChipSelectField
              label={LIFESTYLE_FIELD_NAMES[field]}
              options={LIFESTYLE_LABELS[field]}
              value={lifestyle[field]}
              onChange={(value) => handleChange(field, value)}
              error={errors[field]}
              helperText={LIVING_HELPER_TEXTS[field]}
              required
            />
            {field === 'drinkingFrequency' && <DrinkingPrivacyNote />}
          </div>
        ))}
      </div>

      <StepNavigation onBack={onBack} onNext={handleNext} />
    </div>
  );
}

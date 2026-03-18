'use client';

import { useCallback, useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import { StepHeader } from '@/components/StepHeader';
import { StepNavigation } from '@/components/form/StepNavigation';
import { ChipSelectField } from '@/components/form/ChipSelectField';
import { FieldError } from '@/components/form/FieldError';
import { LIFESTYLE_LABELS, LIFESTYLE_FIELD_NAMES, CONDITION_FIELDS } from '@/constants/lifestyle';
import { INTRO_MAX_LENGTH } from '@/constants/ui';
import type { LifestyleData } from '@/types/lifestyle';

type ConditionField = (typeof CONDITION_FIELDS)[number];

interface StepRoommateConditionsProps {
  lifestyle: LifestyleData;
  onUpdate: (field: keyof LifestyleData, value: string) => void;
  onNext: () => void;
  onBack: () => void;
  intro: string;
  onIntroChange: (intro: string) => void;
  disabled?: boolean;
}

const CONDITION_ERROR_LABELS: Record<string, string> = {
  smokingTolerance: '상대 흡연 허용을 선택해주세요.',
  phoneTolerance: '상대 통화 허용을 선택해주세요.',
  earphoneExpectation: '이어폰 기대를 선택해주세요.',
  sleepEnvPreference: '취침 소리 허용을 선택해주세요.',
  cleanExpectation: '청결 기대를 선택해주세요.',
  drinkingTolerance: '음주 허용을 선택해주세요.',
};

export function StepRoommateConditions({
  lifestyle,
  onUpdate,
  onNext,
  onBack,
  intro,
  onIntroChange,
  disabled,
}: StepRoommateConditionsProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const setFieldRef = useCallback(
    (field: ConditionField | 'intro') => (el: HTMLDivElement | null) => {
      fieldRefs.current[field] = el;
    },
    [],
  );

  const handleNext = () => {
    const newErrors: Record<string, string> = {};

    for (const field of CONDITION_FIELDS) {
      if (!lifestyle[field]) {
        newErrors[field] = CONDITION_ERROR_LABELS[field] ?? '선택해주세요.';
      }
    }

    if (!intro.trim()) {
      newErrors.intro = '자기소개를 입력해주세요.';
    }

    setErrors(newErrors);

    const firstConditionError = CONDITION_FIELDS.find((f) => newErrors[f]);
    if (firstConditionError) {
      fieldRefs.current[firstConditionError]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      return;
    }
    if (newErrors.intro) {
      fieldRefs.current.intro?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    onNext();
  };

  const handleChange = (field: ConditionField, value: string | null) => {
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
        icon={<Heart className="w-8 h-8 text-[var(--knu-primary)]" />}
        title="원하는 룸메 조건"
        description="어떤 룸메를 원하는지 알려주세요"
      />

      <div className="space-y-8">
        {CONDITION_FIELDS.map((field) => (
          <div key={field} ref={setFieldRef(field)}>
            <ChipSelectField
              label={LIFESTYLE_FIELD_NAMES[field]}
              options={LIFESTYLE_LABELS[field]}
              value={lifestyle[field]}
              onChange={(value) => handleChange(field, value)}
              error={errors[field]}
              required
            />
            {field === 'drinkingTolerance' && (
              <p className="mt-2 text-xs text-[var(--knu-text-tertiary)]">
                음주 정보는 매칭 점수에만 반영되며, 상대 프로필에 표시되지 않습니다
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Intro */}
      <div ref={setFieldRef('intro')}>
        <label className="block text-sm font-semibold text-[var(--knu-text-primary)] mb-3">
          자기소개 <span className="text-red-500">*</span>
        </label>
        <textarea
          value={intro}
          onChange={(e) => {
            onIntroChange(e.target.value);
            setErrors((prev) => {
              const next = { ...prev };
              delete next.intro;
              return next;
            });
          }}
          placeholder="예) 도서관 자주 가고, 방에선 조용히 지내는 편이에요. 배려하며 지낼 룸메 찾습니다!"
          maxLength={INTRO_MAX_LENGTH}
          rows={3}
          className="w-full px-4 py-3 border-2 border-[var(--knu-border)] rounded-xl text-sm text-[var(--knu-text-primary)] placeholder:text-[var(--knu-text-tertiary)] focus:outline-none focus:border-[var(--knu-primary)] transition-colors resize-none"
        />
        <div className="flex justify-between mt-1">
          <FieldError message={errors.intro} />
          <span className="text-xs text-[var(--knu-text-tertiary)]">
            {intro.length}/{INTRO_MAX_LENGTH}
          </span>
        </div>
      </div>

      <div className="bg-blue-50 border-2 border-blue-100 rounded-xl p-4">
        <p className="text-sm text-blue-900">
          <strong>프로필 정보는 나중에 수정할 수 있어요</strong>
        </p>
      </div>

      <StepNavigation
        onBack={onBack}
        onNext={handleNext}
        nextLabel={disabled ? '처리 중...' : '완료'}
        disabled={disabled}
      />
    </div>
  );
}

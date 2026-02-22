'use client';

import { useCallback, useRef, useState } from 'react';
import { StepHeader } from '@/components/StepHeader';
import { StepNavigation } from '@/components/form/StepNavigation';
import { FieldError } from '@/components/form/FieldError';
import { ChipSelectField } from '@/components/form/ChipSelectField';
import { LIFESTYLE_LABELS, LIFESTYLE_FIELD_NAMES } from '@/constants/lifestyle';
import { INTRO_MAX_LENGTH } from '@/constants/ui';
import { Sparkles } from 'lucide-react';

export type { LifestyleData } from '@/types/lifestyle';
import type { LifestyleData } from '@/types/lifestyle';

interface StepLifestyleProfileProps {
  lifestyle: LifestyleData;
  onLifestyleChange: (data: LifestyleData) => void;
  intro: string;
  onIntroChange: (intro: string) => void;
  onNext: () => void;
  onBack: () => void;
}

type FieldKey = keyof LifestyleData;

const FIELD_LABELS: Record<FieldKey, string> = {
  smoker: '흡연 여부를 선택해주세요.',
  sleepHabit: '잠버릇을 선택해주세요.',
  indoorEating: '실내 취식 여부를 선택해주세요.',
  bedtime: '취침 시간을 선택해주세요.',
  wakeTime: '기상 시간을 선택해주세요.',
  noiseSensitivity: '소음 민감도를 선택해주세요.',
  cleanliness: '청결도를 선택해주세요.',
  relationshipStyle: '관계 성향을 선택해주세요.',
};

const FIELD_ORDER: FieldKey[] = [
  'smoker',
  'sleepHabit',
  'indoorEating',
  'bedtime',
  'wakeTime',
  'noiseSensitivity',
  'cleanliness',
  'relationshipStyle',
];

export function StepLifestyleProfile({
  lifestyle,
  onLifestyleChange,
  intro,
  onIntroChange,
  onNext,
  onBack,
}: StepLifestyleProfileProps) {
  const [errors, setErrors] = useState<Partial<Record<FieldKey | 'intro', string>>>({});
  const fieldRefs = useRef<Partial<Record<FieldKey | 'intro', HTMLDivElement | null>>>({});

  const setFieldRef = useCallback(
    (field: FieldKey | 'intro') => (el: HTMLDivElement | null) => {
      fieldRefs.current[field] = el;
    },
    [],
  );

  const handleNext = () => {
    const newErrors: Partial<Record<FieldKey | 'intro', string>> = {};

    for (const field of FIELD_ORDER) {
      if (!lifestyle[field]) {
        newErrors[field] = FIELD_LABELS[field];
      }
    }

    if (!intro.trim()) {
      newErrors.intro = '자기소개를 입력해주세요.';
    }

    setErrors(newErrors);

    const firstLifestyleError = FIELD_ORDER.find((f) => newErrors[f]);
    if (firstLifestyleError) {
      fieldRefs.current[firstLifestyleError]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      return;
    }
    if (newErrors.intro) {
      fieldRefs.current.intro?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      return;
    }

    onNext();
  };

  const update = (field: FieldKey, value: string) => {
    onLifestyleChange({ ...lifestyle, [field]: value });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <StepHeader
        icon={<Sparkles className="w-8 h-8 text-[var(--knu-primary)]" />}
        title="생활 패턴 프로필"
        description="나와 맞는 룸메를 찾기 위한 정보예요"
      />

      <div className="space-y-8">
        {FIELD_ORDER.map((field) => (
          <div key={field} ref={setFieldRef(field)}>
            <ChipSelectField
              label={LIFESTYLE_FIELD_NAMES[field]}
              options={LIFESTYLE_LABELS[field]}
              value={lifestyle[field]}
              onChange={(value) => update(field, value)}
              error={errors[field]}
              required
            />
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

      <StepNavigation onBack={onBack} onNext={handleNext} nextLabel="완료" />
    </div>
  );
}

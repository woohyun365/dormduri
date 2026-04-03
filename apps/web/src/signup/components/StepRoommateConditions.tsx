'use client';

import { useCallback, useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import { StepHeader } from '@/components/StepHeader';
import { StepNavigation } from '@/components/form/StepNavigation';
import { ChipSelectField } from '@/components/form/ChipSelectField';
import { FieldError } from '@/components/form/FieldError';
import { DrinkingPrivacyNote } from '@/components/form/DrinkingPrivacyNote';
import { LIFESTYLE_LABELS, LIFESTYLE_FIELD_NAMES, CONDITION_FIELDS } from '@/constants/lifestyle';
import { INTRO_MAX_LENGTH } from '@/constants/ui';
import type { LifestyleData } from '@/types/lifestyle';
import { focusAndScroll } from '@/utils/focus';

type ConditionField = (typeof CONDITION_FIELDS)[number];

interface StepRoommateConditionsProps {
  lifestyle: LifestyleData;
  onUpdate: (field: keyof LifestyleData, value: string | null) => void;
  onNext: () => void;
  onBack: () => void;
  intro: string;
  onIntroChange: (intro: string) => void;
  disabled?: boolean;
}

const CONDITION_HELPER_TEXTS: Record<string, string> = {
  smokingTolerance: '흡연은 어디까지 괜찮나요?',
  phoneTolerance: '방에서 통화는 어디까지 괜찮나요?',
  earphoneExpectation: '이어폰은 꼭 써줬으면 하나요? (영상, 음악, 게임 등)',
  sleepEnvPreference: '룸메가 잘 때 음악이나 영상을 틀어놓고 자도 괜찮나요?',
  screenTolerance: '룸메가 잘 때 화면 불빛을 켜도 괜찮나요? (핸드폰, 태블릿 등)',
  indoorEatingTolerance: '방에서 간식, 배달, 간편식 등 어디까지 괜찮나요?',
  cleanExpectation: '룸메의 청소, 정리정돈 등 방 관리는 어디까지 괜찮나요?',
  drinkingTolerance: '룸메의 음주 빈도가 중요하신가요?',
};

const CONDITION_ERROR_LABELS: Record<string, string> = {
  smokingTolerance: '상대 흡연 허용을 선택해주세요.',
  phoneTolerance: '상대 통화 허용을 선택해주세요.',
  earphoneExpectation: '이어폰 기대를 선택해주세요.',
  sleepEnvPreference: '상대 스피커 허용을 선택해주세요.',
  screenTolerance: '상대 화면 허용을 선택해주세요.',
  indoorEatingTolerance: '상대 실내 취식 허용을 선택해주세요.',
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

  const REQUIRED_CONDITION_FIELDS = ['drinkingTolerance'] as const;

  const handleNext = () => {
    const newErrors: Record<string, string> = {};

    for (const field of REQUIRED_CONDITION_FIELDS) {
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
      focusAndScroll(fieldRefs.current[firstConditionError]);
      return;
    }
    if (newErrors.intro) {
      focusAndScroll(fieldRefs.current.intro);
      return;
    }

    onNext();
  };

  const handleChange = (field: ConditionField, value: string | null) => {
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
        description="나는 이런 룸메가 좋아요"
      />

      <div className="space-y-2">
        <div className="bg-blue-50 border-2 border-blue-100 rounded-xl p-4 keep-all">
          <p className="text-sm text-blue-900">
            <strong>룸메 조건은 나중에 설정해도 돼요</strong>
            <br />
            프로필에서 언제든 수정할 수 있으니 부담 갖지 말고 편하게 입력해보세요!
          </p>
        </div>
        <div className="bg-amber-50 border-2 border-amber-100 rounded-xl p-4 keep-all">
          <p className="text-sm text-amber-900">
            <strong>🔓 조건을 모두 입력하면 매칭도와 호환성 분석이 활성화돼요.</strong>
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {CONDITION_FIELDS.map((field) => {
          const isRequired = field === 'drinkingTolerance';
          return (
            <div key={field} ref={setFieldRef(field)} tabIndex={-1}>
              <ChipSelectField
                label={LIFESTYLE_FIELD_NAMES[field]}
                options={LIFESTYLE_LABELS[field]}
                value={lifestyle[field]}
                onChange={(value) => handleChange(field, value)}
                error={errors[field]}
                helperText={CONDITION_HELPER_TEXTS[field]}
                required={isRequired}
                allowDeselect={!isRequired}
              />
              {field === 'drinkingTolerance' && <DrinkingPrivacyNote />}
            </div>
          );
        })}
      </div>

      {/* Intro */}
      <div ref={setFieldRef('intro')} tabIndex={-1}>
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

      <StepNavigation
        onBack={onBack}
        onNext={handleNext}
        nextLabel={disabled ? '처리 중...' : '완료'}
        disabled={disabled}
      />
    </div>
  );
}

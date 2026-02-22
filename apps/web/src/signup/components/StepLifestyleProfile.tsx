'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { StepHeader } from '@/components/StepHeader';
import { FieldError } from '@/components/form/FieldError';
import { Chip } from '@/components/Chip';
import { Sparkles } from 'lucide-react';

export interface LifestyleData {
  smoker: 'NO' | 'YES' | 'OK' | null;
  sleepHabit: 'NONE' | 'TALKING' | 'SNORING' | 'GRINDING' | null;
  indoorEating: 'NO' | 'OK' | 'VENTILATE' | null;
  bedtime: 'BEFORE_22' | '22_24' | '24_02' | 'AFTER_02' | null;
  wakeTime: 'BEFORE_06' | '06_08' | '08_10' | 'AFTER_10' | null;
  noiseSensitivity: 'LOW' | 'MID' | 'HIGH' | null;
  cleanliness: 'LOW' | 'MID' | 'HIGH' | null;
  relationshipStyle: 'CLOSE' | 'CASUAL' | null;
}

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
        {/* Smoker */}
        <div
          ref={(el) => {
            fieldRefs.current.smoker = el;
          }}
        >
          <label className="block text-sm font-semibold text-[var(--knu-text-primary)] mb-3">
            흡연 여부 <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Chip
              label="비흡연"
              selected={lifestyle.smoker === 'NO'}
              onClick={() => update('smoker', 'NO')}
            />
            <Chip
              label="흡연"
              selected={lifestyle.smoker === 'YES'}
              onClick={() => update('smoker', 'YES')}
            />
            <Chip
              label="무관"
              selected={lifestyle.smoker === 'OK'}
              onClick={() => update('smoker', 'OK')}
            />
          </div>
          <FieldError message={errors.smoker} />
        </div>

        {/* Sleep Habit */}
        <div
          ref={(el) => {
            fieldRefs.current.sleepHabit = el;
          }}
        >
          <label className="block text-sm font-semibold text-[var(--knu-text-primary)] mb-3">
            잠버릇 <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Chip
              label="없음"
              selected={lifestyle.sleepHabit === 'NONE'}
              onClick={() => update('sleepHabit', 'NONE')}
            />
            <Chip
              label="잠꼬대"
              selected={lifestyle.sleepHabit === 'TALKING'}
              onClick={() => update('sleepHabit', 'TALKING')}
            />
            <Chip
              label="코골이"
              selected={lifestyle.sleepHabit === 'SNORING'}
              onClick={() => update('sleepHabit', 'SNORING')}
            />
            <Chip
              label="이갈이"
              selected={lifestyle.sleepHabit === 'GRINDING'}
              onClick={() => update('sleepHabit', 'GRINDING')}
            />
          </div>
          <FieldError message={errors.sleepHabit} />
        </div>

        {/* Indoor Eating */}
        <div
          ref={(el) => {
            fieldRefs.current.indoorEating = el;
          }}
        >
          <label className="block text-sm font-semibold text-[var(--knu-text-primary)] mb-3">
            실내 취식 <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Chip
              label="싫어요"
              selected={lifestyle.indoorEating === 'NO'}
              onClick={() => update('indoorEating', 'NO')}
            />
            <Chip
              label="상관없어요"
              selected={lifestyle.indoorEating === 'OK'}
              onClick={() => update('indoorEating', 'OK')}
            />
            <Chip
              label="환기하면 OK"
              selected={lifestyle.indoorEating === 'VENTILATE'}
              onClick={() => update('indoorEating', 'VENTILATE')}
            />
          </div>
          <FieldError message={errors.indoorEating} />
        </div>

        {/* Bedtime */}
        <div
          ref={(el) => {
            fieldRefs.current.bedtime = el;
          }}
        >
          <label className="block text-sm font-semibold text-[var(--knu-text-primary)] mb-3">
            취침 시간 <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Chip
              label="22시 이전"
              selected={lifestyle.bedtime === 'BEFORE_22'}
              onClick={() => update('bedtime', 'BEFORE_22')}
            />
            <Chip
              label="22~24시"
              selected={lifestyle.bedtime === '22_24'}
              onClick={() => update('bedtime', '22_24')}
            />
            <Chip
              label="24~02시"
              selected={lifestyle.bedtime === '24_02'}
              onClick={() => update('bedtime', '24_02')}
            />
            <Chip
              label="02시 이후"
              selected={lifestyle.bedtime === 'AFTER_02'}
              onClick={() => update('bedtime', 'AFTER_02')}
            />
          </div>
          <FieldError message={errors.bedtime} />
        </div>

        {/* Wake Time */}
        <div
          ref={(el) => {
            fieldRefs.current.wakeTime = el;
          }}
        >
          <label className="block text-sm font-semibold text-[var(--knu-text-primary)] mb-3">
            기상 시간 <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Chip
              label="6시 이전"
              selected={lifestyle.wakeTime === 'BEFORE_06'}
              onClick={() => update('wakeTime', 'BEFORE_06')}
            />
            <Chip
              label="6~8시"
              selected={lifestyle.wakeTime === '06_08'}
              onClick={() => update('wakeTime', '06_08')}
            />
            <Chip
              label="8~10시"
              selected={lifestyle.wakeTime === '08_10'}
              onClick={() => update('wakeTime', '08_10')}
            />
            <Chip
              label="10시 이후"
              selected={lifestyle.wakeTime === 'AFTER_10'}
              onClick={() => update('wakeTime', 'AFTER_10')}
            />
          </div>
          <FieldError message={errors.wakeTime} />
        </div>

        {/* Noise Sensitivity */}
        <div
          ref={(el) => {
            fieldRefs.current.noiseSensitivity = el;
          }}
        >
          <label className="block text-sm font-semibold text-[var(--knu-text-primary)] mb-3">
            소음 민감도 <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Chip
              label="둔감한 편"
              selected={lifestyle.noiseSensitivity === 'LOW'}
              onClick={() => update('noiseSensitivity', 'LOW')}
            />
            <Chip
              label="보통"
              selected={lifestyle.noiseSensitivity === 'MID'}
              onClick={() => update('noiseSensitivity', 'MID')}
            />
            <Chip
              label="민감한 편"
              selected={lifestyle.noiseSensitivity === 'HIGH'}
              onClick={() => update('noiseSensitivity', 'HIGH')}
            />
          </div>
          <FieldError message={errors.noiseSensitivity} />
        </div>

        {/* Cleanliness */}
        <div
          ref={(el) => {
            fieldRefs.current.cleanliness = el;
          }}
        >
          <label className="block text-sm font-semibold text-[var(--knu-text-primary)] mb-3">
            청결도 <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Chip
              label="자유로운 편"
              selected={lifestyle.cleanliness === 'LOW'}
              onClick={() => update('cleanliness', 'LOW')}
            />
            <Chip
              label="보통"
              selected={lifestyle.cleanliness === 'MID'}
              onClick={() => update('cleanliness', 'MID')}
            />
            <Chip
              label="깔끔한 편"
              selected={lifestyle.cleanliness === 'HIGH'}
              onClick={() => update('cleanliness', 'HIGH')}
            />
          </div>
          <FieldError message={errors.cleanliness} />
        </div>

        {/* Relationship Style */}
        <div
          ref={(el) => {
            fieldRefs.current.relationshipStyle = el;
          }}
        >
          <label className="block text-sm font-semibold text-[var(--knu-text-primary)] mb-3">
            관계 성향 <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Chip
              label="친하게 지내요"
              selected={lifestyle.relationshipStyle === 'CLOSE'}
              onClick={() => update('relationshipStyle', 'CLOSE')}
            />
            <Chip
              label="각자 생활이 편해요"
              selected={lifestyle.relationshipStyle === 'CASUAL'}
              onClick={() => update('relationshipStyle', 'CASUAL')}
            />
          </div>
          <FieldError message={errors.relationshipStyle} />
        </div>
      </div>

      {/* Intro */}
      <div
        ref={(el) => {
          fieldRefs.current.intro = el;
        }}
      >
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
          maxLength={200}
          rows={3}
          className="w-full px-4 py-3 border-2 border-[var(--knu-border)] rounded-xl text-sm text-[var(--knu-text-primary)] placeholder:text-[var(--knu-text-tertiary)] focus:outline-none focus:border-[var(--knu-primary)] transition-colors resize-none"
        />
        <div className="flex justify-between mt-1">
          <FieldError message={errors.intro} />
          <span className="text-xs text-[var(--knu-text-tertiary)]">{intro.length}/200</span>
        </div>
      </div>

      <div className="bg-blue-50 border-2 border-blue-100 rounded-xl p-4">
        <p className="text-sm text-blue-900">
          <strong>프로필 정보는 나중에 수정할 수 있어요</strong>
        </p>
      </div>

      <div className="flex gap-3 pt-4">
        <Button variant="outline" size="lg" fullWidth onClick={onBack}>
          이전
        </Button>
        <Button variant="primary" size="lg" fullWidth onClick={handleNext}>
          완료
        </Button>
      </div>
    </div>
  );
}

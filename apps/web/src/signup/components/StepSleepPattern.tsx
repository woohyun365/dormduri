'use client';

import { useCallback, useRef, useState } from 'react';
import { Moon } from 'lucide-react';
import { StepHeader } from '@/components/StepHeader';
import { StepNavigation } from '@/components/form/StepNavigation';
import { ChipSelectField } from '@/components/form/ChipSelectField';
import { LIFESTYLE_LABELS, LIFESTYLE_FIELD_NAMES } from '@/constants/lifestyle';
import type { LifestyleData } from '@/types/lifestyle';

interface StepSleepPatternProps {
  lifestyle: LifestyleData;
  onUpdate: (field: keyof LifestyleData, value: string) => void;
  onNext: () => void;
  onBack: () => void;
}

// 조건부 플로우에서 사용하는 필드 목록
const BASE_FIELDS: (keyof LifestyleData)[] = ['bedtime', 'wakeTime', 'sleepHabit'];
const MEDIA_ACTIVITY_FIELD: keyof LifestyleData = 'screenUsage';
const SOUND_METHOD_FIELD: keyof LifestyleData = 'sleepEnvironment';
const TAIL_FIELDS: (keyof LifestyleData)[] = ['noiseSensitivity'];

// 미디어 활동 옵션 (screenUsage를 활동 기반으로 재정의)
const MEDIA_ACTIVITY_OPTIONS: Record<string, string> = {
  NONE: '그냥 자요',
  AUDIO: '음악만 들어요',
  SCREEN: '영상·게임 등 화면을 봐요',
};

// 소리 방식 옵션 (음악: 이어폰/스피커, 영상: 무음/이어폰/스피커)
const SOUND_OPTIONS_AUDIO: Record<string, string> = {
  EARPHONE: '이어폰으로',
  LOW_SPEAKER: '스피커로 작게',
};

const SOUND_OPTIONS_SCREEN: Record<string, string> = {
  QUIET: '무음으로',
  EARPHONE: '이어폰으로',
  LOW_SPEAKER: '스피커로 작게',
};

const SLEEP_ERROR_LABELS: Record<string, string> = {
  bedtime: '취침 시간을 선택해주세요.',
  wakeTime: '기상 시간을 선택해주세요.',
  sleepHabit: '잠버릇을 선택해주세요.',
  screenUsage: '잠들 때 활동을 선택해주세요.',
  sleepEnvironment: '소리 방식을 선택해주세요.',
  noiseSensitivity: '잠귀를 선택해주세요.',
};

const SLEEP_HELPER_TEXTS: Record<string, string> = {
  bedtime: '보통 몇 시에 잠드나요?',
  wakeTime: '보통 몇 시에 일어나나요?',
  sleepHabit: '가족이나 친구에게 들은 잠버릇이 있나요?',
  screenUsage: '잠들기 전에 보통 뭘 하나요?',
  sleepEnvironment: '소리는 어떻게 듣나요?',
  noiseSensitivity: '소음에 얼마나 민감한가요?',
};

// screenUsage 값에서 활동 타입 파생
function getActivityFromScreenUsage(value: string | null): 'NONE' | 'AUDIO' | 'SCREEN' | null {
  if (!value) return null;
  if (value === 'NO') return 'NONE';
  if (value === 'YES') return 'SCREEN';
  // 새 값 그대로 사용
  return value as 'NONE' | 'AUDIO' | 'SCREEN';
}

export function StepSleepPattern({ lifestyle, onUpdate, onNext, onBack }: StepSleepPatternProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const activity = getActivityFromScreenUsage(lifestyle.screenUsage);
  const needsSoundQuestion = activity === 'AUDIO' || activity === 'SCREEN';

  const setFieldRef = useCallback(
    (field: string) => (el: HTMLDivElement | null) => {
      fieldRefs.current[field] = el;
    },
    [],
  );

  const handleNext = () => {
    const newErrors: Record<string, string> = {};

    for (const field of BASE_FIELDS) {
      if (!lifestyle[field]) {
        newErrors[field] = SLEEP_ERROR_LABELS[field] ?? '선택해주세요.';
      }
    }

    if (!lifestyle[MEDIA_ACTIVITY_FIELD]) {
      newErrors[MEDIA_ACTIVITY_FIELD] = SLEEP_ERROR_LABELS[MEDIA_ACTIVITY_FIELD] ?? '선택해주세요.';
    }

    if (needsSoundQuestion && !lifestyle[SOUND_METHOD_FIELD]) {
      newErrors[SOUND_METHOD_FIELD] = SLEEP_ERROR_LABELS[SOUND_METHOD_FIELD] ?? '선택해주세요.';
    }

    for (const field of TAIL_FIELDS) {
      if (!lifestyle[field]) {
        newErrors[field] = SLEEP_ERROR_LABELS[field] ?? '선택해주세요.';
      }
    }

    setErrors(newErrors);

    const allFields = [
      ...BASE_FIELDS,
      MEDIA_ACTIVITY_FIELD,
      ...(needsSoundQuestion ? [SOUND_METHOD_FIELD] : []),
      ...TAIL_FIELDS,
    ];
    const firstError = allFields.find((f) => newErrors[f]);
    if (firstError) {
      fieldRefs.current[firstError]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    onNext();
  };

  const handleChange = (field: keyof LifestyleData, value: string | null) => {
    if (value === null) return;
    onUpdate(field, value);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      if (field === MEDIA_ACTIVITY_FIELD) {
        delete next[SOUND_METHOD_FIELD];
      }
      return next;
    });

    // 활동 변경 시 소리 방식 리셋
    if (field === MEDIA_ACTIVITY_FIELD) {
      if (value === 'NONE') {
        onUpdate('sleepEnvironment', 'QUIET');
      } else if (
        lifestyle.screenUsage === 'NONE' ||
        (lifestyle.sleepEnvironment === 'QUIET' && value === 'AUDIO')
      ) {
        // "그냥 자요"에서 전환 시 QUIET 잔존 방지 + 음악인데 QUIET(무음) 모순 방지
        onUpdate('sleepEnvironment', '' as string);
      }
    }
  };

  const soundOptions = activity === 'AUDIO' ? SOUND_OPTIONS_AUDIO : SOUND_OPTIONS_SCREEN;

  return (
    <div className="space-y-6">
      <StepHeader
        icon={<Moon className="w-8 h-8 text-[var(--knu-primary)]" />}
        title="수면 패턴"
        description="나의 수면 습관을 알려주세요"
      />

      <div className="space-y-8">
        {/* 기본 필드: 취침, 기상, 잠버릇 */}
        {BASE_FIELDS.map((field) => (
          <div key={field} ref={setFieldRef(field)}>
            <ChipSelectField
              label={LIFESTYLE_FIELD_NAMES[field]}
              options={LIFESTYLE_LABELS[field]}
              value={lifestyle[field]}
              onChange={(value) => handleChange(field, value)}
              error={errors[field]}
              helperText={SLEEP_HELPER_TEXTS[field]}
              required
            />
          </div>
        ))}

        {/* Q1: 잠들 때 활동 */}
        <div ref={setFieldRef(MEDIA_ACTIVITY_FIELD)}>
          <ChipSelectField
            label="잠들 때 활동"
            options={MEDIA_ACTIVITY_OPTIONS}
            value={activity}
            onChange={(value) => handleChange(MEDIA_ACTIVITY_FIELD, value)}
            error={errors[MEDIA_ACTIVITY_FIELD]}
            helperText={SLEEP_HELPER_TEXTS[MEDIA_ACTIVITY_FIELD]}
            required
          />
        </div>

        {/* Q2: 소리 방식 (조건부) */}
        {needsSoundQuestion && (
          <div ref={setFieldRef(SOUND_METHOD_FIELD)}>
            <ChipSelectField
              label="소리 방식"
              options={soundOptions}
              value={lifestyle.sleepEnvironment}
              onChange={(value) => handleChange(SOUND_METHOD_FIELD, value)}
              error={errors[SOUND_METHOD_FIELD]}
              helperText={SLEEP_HELPER_TEXTS[SOUND_METHOD_FIELD]}
              required
            />
          </div>
        )}

        {/* 잠귀 */}
        {TAIL_FIELDS.map((field) => (
          <div key={field} ref={setFieldRef(field)}>
            <ChipSelectField
              label={LIFESTYLE_FIELD_NAMES[field]}
              options={LIFESTYLE_LABELS[field]}
              value={lifestyle[field]}
              onChange={(value) => handleChange(field, value)}
              error={errors[field]}
              helperText={SLEEP_HELPER_TEXTS[field]}
              required
            />
          </div>
        ))}
      </div>

      <StepNavigation onBack={onBack} onNext={handleNext} />
    </div>
  );
}

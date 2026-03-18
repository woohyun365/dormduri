import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StepSleepPattern } from '../StepSleepPattern';
import type { LifestyleData } from '@/types/lifestyle';

vi.mock('lucide-react', () => ({
  Moon: () => null,
  Check: () => null,
}));

const emptyLifestyle: LifestyleData = {
  bedtime: null,
  wakeTime: null,
  sleepHabit: null,
  sleepEnvironment: null,
  noiseSensitivity: null,
  smokingBehavior: null,
  indoorEating: null,
  phoneBehavior: null,
  earphoneUsage: null,
  cleanLevel: null,
  drinkingFrequency: null,
  relationshipStyle: null,
  temperatureSensitivity: null,
  smokingTolerance: null,
  phoneTolerance: null,
  earphoneExpectation: null,
  sleepEnvPreference: null,
  cleanExpectation: null,
  drinkingTolerance: null,
};

const filledSleep: Partial<LifestyleData> = {
  bedtime: '22_24',
  wakeTime: '07_08',
  sleepHabit: 'NONE',
  sleepEnvironment: 'QUIET',
  noiseSensitivity: 'NORMAL',
};

describe('StepSleepPattern', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('미선택 상태에서 다음 클릭 시 에러를 표시하고 진행하지 않는다', () => {
    const onNext = vi.fn();

    render(
      <StepSleepPattern
        lifestyle={emptyLifestyle}
        onUpdate={vi.fn()}
        onNext={onNext}
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

    expect(screen.getByText('취침 시간을 선택해주세요.')).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('모든 필드가 채워지면 onNext가 호출된다', () => {
    const onNext = vi.fn();

    render(
      <StepSleepPattern
        lifestyle={{ ...emptyLifestyle, ...filledSleep }}
        onUpdate={vi.fn()}
        onNext={onNext}
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

    expect(onNext).toHaveBeenCalled();
  });
});

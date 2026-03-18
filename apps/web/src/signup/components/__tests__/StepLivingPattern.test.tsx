import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StepLivingPattern } from '../StepLivingPattern';
import type { LifestyleData } from '@/types/lifestyle';

vi.mock('lucide-react', () => ({
  Home: () => null,
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

const filledLiving: Partial<LifestyleData> = {
  smokingBehavior: 'NO',
  indoorEating: 'OK',
  phoneBehavior: 'OUTSIDE',
  earphoneUsage: 'ALWAYS',
  cleanLevel: 'WEEKLY_1_2',
  drinkingFrequency: 'SOMETIMES',
  relationshipStyle: 'CASUAL',
  temperatureSensitivity: 'NORMAL',
};

describe('StepLivingPattern', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('미선택 상태에서 다음 클릭 시 에러를 표시하고 진행하지 않는다', () => {
    const onNext = vi.fn();

    render(
      <StepLivingPattern
        lifestyle={emptyLifestyle}
        onUpdate={vi.fn()}
        onNext={onNext}
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

    expect(screen.getByText('흡연 여부를 선택해주세요.')).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('모든 필드가 채워지면 onNext가 호출된다', () => {
    const onNext = vi.fn();

    render(
      <StepLivingPattern
        lifestyle={{ ...emptyLifestyle, ...filledLiving }}
        onUpdate={vi.fn()}
        onNext={onNext}
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

    expect(onNext).toHaveBeenCalled();
  });

  it('음주 빈도 필드에 비노출 안내가 표시된다', () => {
    render(
      <StepLivingPattern
        lifestyle={emptyLifestyle}
        onUpdate={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/음주 정보는 매칭 점수에만 반영되며, 상대 프로필에 표시되지 않습니다/),
    ).toBeInTheDocument();
  });
});

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StepRoommateConditions } from '../StepRoommateConditions';
import type { LifestyleData } from '@/types/lifestyle';

vi.mock('lucide-react', () => ({
  Heart: () => null,
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

const filledConditions: Partial<LifestyleData> = {
  smokingTolerance: 'NO_ONLY',
  phoneTolerance: 'BRIEF_OK',
  earphoneExpectation: 'ANY',
  sleepEnvPreference: 'QUIET_ONLY',
  cleanExpectation: 'BASIC',
  drinkingTolerance: 'ANY',
};

describe('StepRoommateConditions', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('빈 상태에서 다음 클릭 시 에러를 표시하고 진행하지 않는다', () => {
    const onNext = vi.fn();

    render(
      <StepRoommateConditions
        lifestyle={emptyLifestyle}
        onUpdate={vi.fn()}
        intro=""
        onIntroChange={vi.fn()}
        onNext={onNext}
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '완료' }));

    expect(screen.getByText('상대 흡연 허용을 선택해주세요.')).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('조건은 모두 선택했지만 자기소개가 비어있으면 에러를 표시한다', () => {
    const onNext = vi.fn();

    render(
      <StepRoommateConditions
        lifestyle={{ ...emptyLifestyle, ...filledConditions }}
        onUpdate={vi.fn()}
        intro=""
        onIntroChange={vi.fn()}
        onNext={onNext}
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '완료' }));

    expect(screen.getByText('자기소개를 입력해주세요.')).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('모든 조건 + 자기소개 입력 시 onNext가 호출된다', () => {
    const onNext = vi.fn();

    render(
      <StepRoommateConditions
        lifestyle={{ ...emptyLifestyle, ...filledConditions }}
        onUpdate={vi.fn()}
        intro="테스트 소개입니다."
        onIntroChange={vi.fn()}
        onNext={onNext}
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '완료' }));

    expect(onNext).toHaveBeenCalled();
  });

  it('자기소개 글자 수가 표시된다', () => {
    render(
      <StepRoommateConditions
        lifestyle={emptyLifestyle}
        onUpdate={vi.fn()}
        intro="안녕하세요"
        onIntroChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText('5/200')).toBeInTheDocument();
  });
});

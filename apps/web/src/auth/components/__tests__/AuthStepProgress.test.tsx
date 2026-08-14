import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthStepProgress } from '../layout/AuthStepProgress';

const STEP_LABELS = [
  '학교 이메일',
  '필수 동의',
  '로그인 정보',
  '학교·기본 정보',
  '가입 완료',
] as const;

function renderProgress(currentStep: number) {
  return render(
    <AuthStepProgress
      ariaLabel="회원가입 진행 상태"
      currentStep={currentStep}
      totalSteps={STEP_LABELS.length}
      stepLabels={STEP_LABELS}
    />,
  );
}

describe('AuthStepProgress', () => {
  it('모바일에서 현재 단계와 전체 단계를 compact하게 제공한다', () => {
    renderProgress(3);

    expect(screen.getByText('3/5 · 로그인 정보')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '로그인 정보 단계' })).toHaveAttribute(
      'aria-valuenow',
      '3',
    );
  });

  it('중복 step bubble 없이 하나의 progressbar만 제공한다', () => {
    renderProgress(2);

    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    expect(screen.getByText('2/5 · 필수 동의')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('가입 완료 단계는 green 100% progress로 완료 상태를 유지한다', () => {
    renderProgress(5);

    expect(screen.getByText('5/5 · 가입 완료')).toHaveClass('text-emerald-700');
    expect(screen.getByText('100%')).toHaveClass('text-emerald-700');
    expect(screen.getByRole('progressbar', { name: '가입 완료 단계' })).toHaveAttribute(
      'aria-valuenow',
      '5',
    );
  });
});
